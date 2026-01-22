
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'
import crypto from 'crypto';
import dotenv from 'dotenv';
import logger from '../../observability/logger';

import User,{IUser} from './auth.model';
import { SessionModel } from './session.model';
dotenv.config();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TTL = process.env.ACCESS_TTL || "15m";
const REFRESH_TTL = process.env.REFRESH_TTL || "7d";
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_LENGTH = Number(process.env.OTP_LENGTH || 6);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_RESEND_LIMIT = Number(process.env.OTP_RESEND_LIMIT || 3);


// Implemented to be later
export async function sendEmail(to:string,subject:string,body:string) {

}



export function signAccessToken(user: IUser,log:any) {

  log.info({userId: user._id},'Signing Access Token for the User');
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, email: user.email },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

export function signRefreshToken(user: IUser,log:any){
    log.info({userId: user._id},'Signing Access Token for the User');
    return jwt.sign(
        { sub: user._id.toString(), tv: user.tokenVersion },
        REFRESH_SECRET,
        { expiresIn: REFRESH_TTL }
    )
}


export function verifyRefreshToken(token: string) {
  if (!REFRESH_SECRET) {
    console.error("Missing REFRESH_SECRET env var!");
    throw new Error("MISSING_REFRESH_SECRET");
  }

  if (!token || typeof token !== "string") {
    console.error("No token provided to verifyRefreshToken");
    throw new Error("NO_REFRESH_TOKEN");
  }

  const trimmed = token.trim();

  try {
    console.log("🔍 verifyRefreshToken - token length:", trimmed.length);
    const decoded = jwt.verify(trimmed, REFRESH_SECRET) as {
      sub: string;
      tv: number;
      iat?: number;
      exp?: number;
    };
    console.log("✅ verifyRefreshToken - decoded:", decoded);
    return decoded;
  } catch (err: any) {
    console.error("❌ verifyRefreshToken error:", err && err.name, err && err.message);
    // Preserve error names so caller can decide
    if (err && err.name === "TokenExpiredError") throw new Error("REFRESH_TOKEN_EXPIRED");
    if (err && err.name === "JsonWebTokenError") throw new Error("REFRESH_TOKEN_INVALID");
    throw new Error("REFRESH_TOKEN_VERIFY_FAILED");
  }
}


export function hashPassword(plain:string) {
    return bcrypt.hash(plain,BCRYPT_ROUNDS)
}

export async function verifyPassword(plain:string,hash:string) {
    return bcrypt.compare(plain,hash)
}

/** Generate numeric OTP  */
export function generateOTP(): string {
    const max = Math.pow(10,OTP_LENGTH)
    const num = Math.floor(Math.random()*max)
    return num.toString().padStart(OTP_LENGTH,"0")
}

/** Hash otp */
export function hashOtp(otp:string) {
    return crypto.createHash('sha256').update(otp).digest('hex')
}

export async function createUserAndSendOtp(params:{name:string,email:string,password:string},log:any) {

    log.info('Checking if user already exists');
    const existing= await User.findOne({email:params.email})
    if(existing) {
        log.warn('Email already Exists');
        throw new Error('EMAIL_ALREADY_EXISTS')
    }

    const passwordHash = await hashPassword(params.password)

    const user = await User.create({
        name: params.name,
        email: params.email,
        passwordHash,
        role: 'user',
        isEmailVerified: false
    })

    // success log for new user creation
    log.info(`New user registered: ${user._id} (${user.email})`);

    await issueAndEmailOtp(user,log)
    log.info('OTP issued and email sent');
    return user
}

export async function issueAndEmailOtp(user: IUser,log: any){
    const otp = generateOTP()
    console.log("OTP IS:",otp)

    log.info({userId: user._id},'OTP is storing in the database')
    user.otp = {
        codeHash: hashOtp(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
        attempts: 0,
        resendCount: (user.otp?.resendCount ?? 0)
    }
    await user.save()

    log.info({userId: user._id},'Email with the OTP is send to the user')
    // await sendEmail(user.email,'Your StreamSphere verification code',
    //     `Your verification code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`
    // )
}

export async function resendOtp(email:string,log: any) {
    const user = await User.findOne({email})
    if(!user) {
        log.warn(
            {email:email},
            'User not found in the DB');
        throw new Error('USER_NOT_FOUND');
    }

    if(user.isEmailVerified) {
        log.warn(
            {email: email},
            'User email already verified'
        );
        throw new Error('ALREADY_VERIFIED');
    }

    const currentResends = user.otp?.resendCount ?? 0
    if(currentResends >= OTP_RESEND_LIMIT) {
        log.warn(
            {email:email},
            'OTP Resend Limit Reached'
        );
        throw new Error('RESEND_LIMIT_REACHED');
    }

    // bump count then issue new code
    user.otp = {
        codeHash: user.otp?.codeHash ?? "",
        expiresAt: user.otp?.expiresAt ?? new Date(),
        attempts: user.otp?.attempts ?? 0,
        resendCount: currentResends + 1
    }
    await user.save()
    await issueAndEmailOtp(user,log)
    return true
}


/** Verify otp -> activate user */
export async function verifyEmailOtp(params:{email:string;otp:string},log:any) {
    const user = await User.findOne({email:params.email})
    if(!user) {
        log.warn({ email: params.email },'User not Found in DB');
        throw new Error('USER_NOT_FOUND');
    }

    if(!user.otp?.codeHash || !user?.otp?.expiresAt) {
        log.warn('Error in OTP Issue')
        throw new Error('NO_OTP_ISSUED')
    }
    
    if(user.isEmailVerified) {
        log.info('Email already verified');
        return true;
    }

    if(user.otp?.attempts >= OTP_MAX_ATTEMPTS) {
        log.warn({ userId: user._id },'OTP Maximum attempt reached')
        throw new Error('OTP_MAX_ATTEMPTS')
    }

    if(user.otp?.expiresAt.getTime() < Date.now()) {
        log.warn({ userId: user._id },'OTP Expired');
        throw new Error('OTP_EXPIRED')
    }

    const providedHash = hashOtp(params.otp)
    const ok = providedHash === user.otp.codeHash 

    user.otp.attempts = (user.otp.attempts ?? 0) +1

    if(!ok){
        await user.save()
        log.warn(
         { 
            userId: user._id, email: user.email
         },'OTP is Invalid');
        throw new Error('OTP_INVALID');
    }

    // Success -> verify , clear otp
    user.isEmailVerified = true
    user.otp = undefined
    await user.save()

    log.info(
        { userId: user._id, email: user.email },
        'Email verified successfully'
    );

    return true;
}



function parseDevice(userAgent:string):string {
    if(!userAgent) return 'unknown Device';

    if(userAgent.includes('Andriod')) return 'Android Device';
    if(userAgent.includes('iPhone')) return 'iPhone Device';
    if(userAgent.includes('iPad')) return 'iPad Device';
    if(userAgent.includes('Windows')) return 'Windows PC';
    if(userAgent.includes('Macintosh')) return 'Mac PC';    
    if(userAgent.includes('Linux')) return 'Linux PC';

    return 'unknown Device';
}

/** Login only if verified */
export async function loginWithEmail(email:string,password:string,log:any,options?:{ipAddress?:string;userAgent?:string}) {

    // checking user exist in the db or not
    log.info({email},'Checking database for user during login');
    const user = await User.findOne({email})
    if(!user) {
        log.info({email},'User with that credentials not exist');
        throw new Error('INVALID_CREDENTIALS');
    }
    if(!user.isEmailVerified){
        log.info({email},'Email is not verified');
        throw new Error('EMAIL_NOT_VERIFIED')
    }
    
    const ok = await verifyPassword(password,user.passwordHash)
    if(!ok) {
        log.info({email},'Credentials provided is invalid');
        throw new Error('INVALID_CREDENTIALS');
    }

    
    log.info({email},'Assign of Access and Refresh Token');
    const accessToken = signAccessToken(user,log);
    const refreshToken = signRefreshToken(user,log);
    
    // session creation for the user
    log.info({email},'Session creation for the user is started')
    await SessionModel.create({
        userId: user._id,
        refreshTokenHash: refreshToken,
        deviceInfo: parseDevice(options?.userAgent || ''),
        ipAddress: options?.ipAddress || '',
        userAgent: options?.userAgent || '',
        isActive: true,
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 7*24*60*60*1000)
    })

    return {accessToken,refreshToken,user}
}

export async function refreshTokens(oldRefresh:string,log:any) {
    console.log("Before Verification of Refresh Token")
    const payload = verifyRefreshToken(oldRefresh)
    console.log("After Verification of Refresh Token")
    const user = await User.findById(payload.sub)
    if(!user) throw new Error('INVALID_REFRESH')
    if(user.tokenVersion !== payload.tv) throw new Error('INVALID_REFRESH_VERSION')

    // rotating the refresh token again and again for the more security
    const accessToken = signAccessToken(user,log)
    const refreshToken = signRefreshToken(user,log)
    
    return { accessToken,refreshToken,user }
}

export async function logout(userId: string){
    // invalidate the all refersh token by bumping tokenVersion
    await User.findByIdAndUpdate(userId,{$inc:{tokenVersion:1}})
    return true
}

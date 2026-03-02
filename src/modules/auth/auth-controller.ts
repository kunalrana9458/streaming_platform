import { Request,Response } from 'express'
import { email, z } from 'zod'
import { 
    createUserAndSendOtp,
    verifyEmailOtp,
    resendOtp,
    loginWithEmail,
    refreshTokens,
    logout
} from './auth.service'

import User from './auth.model'
import { error } from 'console'

export const register = async(req:Request,res:Response) => {
    try {

        req.log.info('Starting user registration process'); 

        const body = z.object({
            name: z.string().min(2),
            email: z.string().email(),
            password: z.string().min(6)
        }).parse(req.body)

        await createUserAndSendOtp(body,req.log)
        return res.json({message: 'Registered. OTP Sent to email.'})
    } catch (error:any) {
        const code = error.message === 'EMAIL_ALREADY_EXISTS' ? 409 : 400;
        req.log.info({error:error.message},'User registration failed');
        return res.status(code).json({error:{code:error.message || 'REGISTER_FAILED'}})
    }
}

export const verifyOtp = async(req:Request,res:Response) => {
    try {        

        // debug
        console.log("REQUEST BODY IS:",req.body)

        const body = z.object({
            email: z.string().email(),
            otp: z.string().length(Number(process.env.OTP_LENGTH || 6))
        }).parse(req.body)

        req.log.info('Starting OTP Verification process')

        await verifyEmailOtp(body,req.log);
        return res.json({message: 'Email Verified Successfully'})
    } catch (e:any) {
        let status = 400
        if(['USER_NOT_FOUND'].includes(e.message)) status = 404;
        if(['OTP_EXPIRED','OTP_INVALID','NO_OTP_ISSUED','OTP_MAX_ATTEMPTS'].includes(e.message)) status = 400;

        req.log.warn(
            { error: e.message, email: req.body?.email },
            'OTP Verification failed'
        );

        return res.status(status).json({error:{code:e.message,message:'OTP Verification Failed'}})
    }
}



export const resendOTPHandler = async(req:Request,res:Response) => {
    try {
        const body = z.object({email: z.string().email()}).parse(req.body);
        req.log.info(
            { email: req.body?.email },
            'OTP Resend Process Started'
        )
        await resendOtp(body.email,req.log)
        return res.json({message: 'OTP resent if allowed'})
    } catch (e:any) {
        const code = e.message === 'USER_NOT_FOUND' ? 404 : 429;

        req.log.warn(
            { error: e.message, email: req.body?.email },
            'OTP resends failed'
        );

        return res.status(code).json({error:{code:e.message,message:'Cannot resend OTP'}})
    }
}




export const login = async(req:Request,res:Response) => {

    req.log.info({email:req.body.email},'Login attempt started');

    try {
        const body = z.object({
            email: z.string().email(),
            password: z.string().min(6)
        }).parse(req.body)

        const {accessToken,refreshToken,user} = await loginWithEmail(
                                                          body.email,
                                                          body.password,
                                                          req.log,
                                                         {
                                                            ipAddress: req.ip,
                                                            userAgent: req.headers['user-agent'] || 'unknown'
                                                         });

        req.log.info({email},'User Logged in Successfully');

        res.cookie("accessToken",accessToken,{
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/",
            maxAge: 15*60*1000
        });
        
        res.cookie("refreshToken",refreshToken,{
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/",
            maxAge: 7*24*60*60*1000
        });

        return res.json({
            accessToken,
            refreshToken,
            user: {id:user._id,name:user.name,email:user.email,role:user.role}
        })
    } catch (e:any) {
        let code = 400
        if(e.message === 'EMAIL_NOT_VERIFIED') code = 403
        if(e.message === 'INVALID_CREDENTIALS') code = 401
        req.log.error({email,error:e.message || 'Login Failed'});
        return res.status(code).json({error:{code:e.message,message: 'Login failed'}})
    }
}



export const refresh = async (req:Request,res:Response) => {
    try {
        const body = z.object({refreshToken: z.string().min(10)}).parse(req.body)
        req.log.info('Regenerating the Refresh and Access Token for token rotation')
        const { accessToken,refreshToken,user } = await refreshTokens(body.refreshToken,req.log);
        return res.json({
            accessToken,
            refreshToken,
            user: {id: user._id, name:user.name, email: user.email,role: user.role}
        })
    } catch (error:any) {
        req.log.info({error:error.message,message:'Error in the token generation'})
        return res.status(401).json({error:{code:'INVALID_REFERSH',message: 'Invalid Refresh token'}})
    }
}

export const profile = async(req:any,res:Response) => {
    try {
        req.log.info({userId: req.user.id},'Get the User profile Details')
        const user = await User.findById(req.user.id).select("_id name email role isEmailVerified createdAt")
        return res.json({user})
    } catch (error) {
        req.log.info({userId: req.user.id},'Erorr in the getting user profile details');
        return res.status(400).json({error:{code:"NOT_FOUND",message:'User not found'}})
    }
}

export const logoutHandler = async(req:any,res:Response) => {
    try {
        req.log.info({userId: req.user.id},'Logging Out the User');
        return await logout(req.user.id,req.log)
    } catch (e) {
        req.log.info('Error in the user logout');
        return res.status(400).json({error:{code:'LOGOUT_FAILED',message:'Unable to Logout'}})
    }
}
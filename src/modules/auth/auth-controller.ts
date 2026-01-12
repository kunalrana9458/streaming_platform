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

export const register = async(req:Request,res:Response) => {
    try {

        req.log.info('Starting user registration process'); 

        const body = z.object({
            name: z.string().min(2),
            email: z.string().email(),
            password: z.string().min(6)
        }).parse(req.body)

        await createUserAndSendOtp(body)
        return res.json({message: 'Registered. OTP Sent to email.'})
    } catch (error:any) {
        const code = error.message === 'EMAIL_ALREADY_EXISTS' ? 409 : 400
        return res.status(code).json({error:{code:error.message || 'REGISTER_FAILED'}})
    }
}

export const verifyOtp = async(req:Request,res:Response) => {
    try {
        const body = z.object({
            email: z.string().email(),
            otp: z.string().length(Number(process.env.OTP_LENGTH || 6))
        }).parse(req.body)

        await verifyEmailOtp(body)
        return res.json({message: 'Email Verified Successfully'})
    } catch (e:any) {
        let status = 400
        if(['USER_NOT_FOUND'].includes(e.message)) status = 404
        if(['OTP_EXPIRED','OTP_INVALID','NO_OTP_ISSUED','OTP_MAX_ATTEMPTS'].includes(e.message)) status = 400
        return res.status(status).json({error:{code:e.message,message:'OTP Verification Failed'}})
    }
}



export const resendOTPHandler = async(req:Request,res:Response) => {
    try {
        const body = z.object({email: z.string().email()}).parse(req.body)
        await resendOtp(body.email)
        return res.json({message: 'OTP resent if allowed'})
    } catch (e:any) {
        const code = e.message === 'USER_NOT_FOUND' ? 404 : 429
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
                                                         {
                                                            ipAddress: req.ip,
                                                            userAgent: req.headers['user-agent'] || 'unknown'   
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
        return res.status(code).json({error:{code:e.message,message: 'Login failed'}})
    }
}



export const refresh = async (req:Request,res:Response) => {
    try {
        const body = z.object({refreshToken: z.string().min(10)}).parse(req.body)
        console.log(body.refreshToken);
        const { accessToken,refreshToken,user } = await refreshTokens(body.refreshToken)
        return res.json({
            accessToken,
            refreshToken,
            user: {id: user._id, name:user.name, email: user.email,role: user.role}
        })
    } catch (error) {
        return res.status(401).json({error:{code:'INVALID_REFERSH',message: 'Invalid Refresh token'}})
    }
}

export const profile = async(req:any,res:Response) => {
    try {
        const user = await User.findById(req.user.id).select("_id name email role isEmailVerified createdAt")
        return res.json({user})
    } catch (error) {
        return res.status(400).json({error:{code:"NOT_FOUND",message:'User not found'}})
    }
}

export const logoutHandler = async(req:any,res:Response) => {
    try {
        return await logout(req.user.id)
    } catch (e) {
        return res.status(400).json({error:{code:'LOGOUT_FAILED',message:'Unable to Logout'}})
    }
}
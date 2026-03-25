import rateLimit from "express-rate-limit";

export const globalRateLimiter = rateLimit({
    windowMs: 15*60*1000,
    max: 100,
    message: {
        success: false,
        message: "Too many request, please try again later"
    }
})
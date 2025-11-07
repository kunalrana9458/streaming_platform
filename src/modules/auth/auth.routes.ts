import {Router} from 'express'
import {
    register,
    verifyOtp,
    resendOTPHandler,
    login,
    refresh,
    profile,
    logoutHandler
} from './auth-controller'
import { requireAuth } from '../../middleware/authMiddleware'

const router = Router()

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOTPHandler);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/profile", requireAuth, profile);
router.post("/logout", requireAuth, logoutHandler);

export default router;
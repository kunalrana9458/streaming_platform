import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;

export interface AuthRequest extends Request {
  user?: { id: string; role: "user" | "admin" };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // const header = req.headers.authorization || "";
    const token = req.cookies.accessToken; // fetch token from the cookie 
    if (!token) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing token" } });

    const payload = jwt.verify(token, ACCESS_SECRET) as { sub: string; role: "user" | "admin" };
    console.log(payload)
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch(error) {
    console.log(error)
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });
  }
}

export function requireRole(role: "admin") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Login required" } });
    if (req.user.role !== role) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role" } });
    next();
  };
}

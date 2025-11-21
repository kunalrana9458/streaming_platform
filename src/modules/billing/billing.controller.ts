
import express, {Request,Response} from 'express'
import { z } from 'zod'
import { createCustomer } from './billing.service'

export async function createCustomerController(req:any,res:Response) {
    try {
        const authUserId = (req as any).user.id as string | undefined;    
        const customer = await createCustomer(authUserId as string)

        return res.status(201).json({message:'Customer Created',customer})
    } catch (error:any) {
        return res
               .status(400)
               .json({error:{code:'CUST_BILLING_CREATION_ERR',message:error.message}})
    }
}
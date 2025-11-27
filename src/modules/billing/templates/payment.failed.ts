
function paymentFailed(name:string,portalUrl:string,amount:string,currency:string) {
    return `
    <!doctype html>
<html>
  <body>
    <p>Hi ${name},</p>
    <p>We couldn't process your recent payment of <b>${amount} ${currency}</b> for your Stremesphere subscription.</p>
    <p>Please update your payment method to avoid service interruption.</p>
    <p><a href="${portalUrl}">Update payment method / Manage subscription</a></p>
    <p>If you think this is a mistake, reply to this email and we'll help.</p>
    <p>— Stremesphere Team</p>
  </body>
</html>

    `
}

export default paymentFailed;
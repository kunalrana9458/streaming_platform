function paymentSucceed(name:string, amount:string, currency:string) {
  return `
    <!doctype html>
<html>
  <body>
    <p>Hi ${name},</p>
    <p>Thanks! Your payment of <b>${amount} ${currency} </b> was successful.</p>
    <p>Your subscription is active. Enjoy streaming!</p>
    <p>— Stremesphere Team</p>
  </body>
</html>
    `
}

export default paymentSucceed;


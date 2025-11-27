
function paymentUpdate(name:string,portalUrl:string) {
    return `
    <!doctype html>
<html>
  <body>
    <p>Hi ${name},</p>
    <p>Click below to update your payment method or view invoices.</p>
    <p><a href="${portalUrl}">Manage billing & payment method</a></p>
    <p>— Stremesphere Team</p>
  </body>
</html>

    `
}

export default paymentUpdate;
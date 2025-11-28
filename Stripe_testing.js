

const stripe = require('stripe')('sk_test_51SVmaCLkIHDctLRBkVB3oDnE6ygFAbMKSWZXIm6Zu6rXQcCTxNLzRXEn5Cgvblsf8P75Kr4Ymhxwem4KLurANssr009gJEcYXL')
stripe.products.create({
    name: 'Starter Subscription',
    description: '$12/Month subscripition'
}).then((product) => {
    stripe.prices.create({
        unit_amount: 1200,
        currency: 'usd',
        recurring: {
            interval: 'month'
        },
        product: product.id,
    }).then(price => {
        console.log('Success! Here is your starter subscription product id: '+ product.id)
        console.log('Success! Here is your starter subscription price id: ' + price.id )
    })
})
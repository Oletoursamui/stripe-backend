const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
app.use(cors());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);


// 🔥 WEBHOOK (VA ANTES DE express.json)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log('❌ Error webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

 // ✅ PAGO CONFIRMADO REAL
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;

  console.log('✅ PAGO CONFIRMADO');
  console.log('Cliente:', session.customer_details);
  console.log('Total:', session.amount_total);
  console.log('Descripción:', session.metadata?.descripcion);

  console.log('📤 Intentando enviar email...');

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'doomcycles81@gmail.com',
      subject: 'Nuevo pago recibido 💰',
      html: `
        <h2>Pago confirmado</h2>
        <p><strong>Cliente:</strong> ${session.customer_details?.email || 'No disponible'}</p>
        <p><strong>Total:</strong> ${session.amount_total / 100} THB</p>
        <p><strong>Reserva:</strong> ${session.metadata?.descripcion || 'Sin descripción'}</p>
      `
    });

    console.log('📧 Email enviado');

  } catch (error) {
    console.error('❌ Error enviando email:', error);
  }
}

  res.status(200).send();
});


// 🔥 ESTO VA DESPUÉS DEL WEBHOOK
app.use(express.json());


// 👉 TU ENDPOINT ORIGINAL (NO TOCADO)
app.post('/crear-pago', async (req, res) => {
  try {
    const { amount, description } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'thb',
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: description || 'Reserva Tour'
            }
          },
          quantity: 1
        }
      ],
      mode: 'payment',

      metadata: {
        descripcion: description
      },

      success_url: 'https://www.oletoursamui.com/reserva-confirmada',
      cancel_url: 'https://www.oletoursamui.com/pago-cancelado'
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creando pago' });
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Servidor corriendo en puerto', PORT);
});

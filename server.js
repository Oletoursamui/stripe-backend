const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
app.use(cors());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);


// 🔥 WEBHOOK (ANTES de express.json)
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const customerEmail = session.customer_details?.email || 'No disponible';
    const telefono = session.metadata?.telefono || 'No disponible';

    const descripcion = session.metadata?.descripcion || '';
    const partes = descripcion.split(' - ');
    const nombre = partes[0] || 'Cliente';
    const fecha = partes[1] || '';

    console.log('✅ PAGO CONFIRMADO');
    console.log('Email:', customerEmail);
    console.log('Nombre:', nombre);
    console.log('Fecha:', fecha);

    try {
  await resend.emails.send({
    from: 'Olé Tours <info@oletoursamui.com>',
    to: [customerEmail, 'oletours.kohsamui@gmail.com'],
    subject: `Pago recibido – Olé Tours (${Date.now()})`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width:640px; margin:auto; background:#ffffff; padding:25px; border-radius:10px;">

      <!-- TRUCO ANTI-GMAIL -->
      <span style="display:none;">${Date.now()}</span>

      <!-- HEADER -->
      <div style="display:flex; align-items:center; margin-bottom:15px;">
        <img src="https://primary.jwwb.nl/public/q/x/b/temp-rxsbzwvfehskyqcezfxp/ol-tours-3-high.png?enable-io=true&width=140" style="width:60px; margin-right:12px;">
        <h2 style="margin:0; font-size:22px;">Pago recibido</h2>
      </div>

      <div style="height:1px; background:#eee; margin:10px 0;"></div>

      <!-- DETALLES -->
      <p><strong>Contacto:</strong> ${customerEmail} | ${telefono}</p>
      <p><strong>Cliente:</strong> ${nombre}</p>
      <p><strong>Fecha:</strong> ${fecha}</p>
      <p><strong>Importe:</strong> ${session.amount_total / 100} THB</p>

      <div style="height:1px; background:#eee; margin:10px 0;"></div>

      <!-- TEXTO -->
      <p>Recibirás los detalles de tu reserva próximamente.</p>

      <!-- FOOTER -->
      <p style="font-size:13px; color:#76c5cc; margin-top:15px;">
        <a href="https://www.oletoursamui.com" style="color:#76c5cc;">Web</a> |
        <a href="mailto:info@oletoursamui.com" style="color:#76c5cc;">Email</a> |
        <a href="https://wa.me/660925792007" style="color:#76c5cc;">WhatsApp</a> |
        <a href="https://www.instagram.com/oletours_samui/" style="color:#76c5cc;">Instagram</a>
      </p>

    </div>
    `
  });

      console.log('📧 Email enviado correctamente');

    } catch (error) {
      console.error('❌ Error enviando email:', error);
    }
  }

  res.status(200).json({ received: true });
});


// 🔥 DESPUÉS
app.use(express.json());


// 👉 CREAR PAGO
app.post('/crear-pago', async (req, res) => {
  try {
    const { amount, description, telefono } = req.body;

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
        descripcion: description,
        telefono: telefono || ''
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

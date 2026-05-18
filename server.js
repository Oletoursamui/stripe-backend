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

    const customerEmail = session.customer_details?.email;

    console.log('📤 Intentando enviar email a:', customerEmail);

    try {
      await resend.emails.send({
        from: 'Ole Tours Samui <info@oletoursamui.com>',
        to: customerEmail || 'doomcycles81@gmail.com',
        subject: 'Confirmación de pago',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333; line-height: 1.6;">

            <!-- LOGO -->
            <div style="text-align: center; margin-bottom: 25px;">
              <img src="https://primary.jwwb.nl/public/q/x/b/temp-rxsbzwvfehskyqcezfxp/ol-tours-3-high.png?enable-io=true&width=140" alt="Olé Tours Samui" style="max-width: 160px;">
            </div>

            <!-- TÍTULO -->
            <h2 style="color: #000; font-weight: 600;">Confirmación de pago</h2>

            <!-- TEXTO -->
            <p>Te informamos de que hemos recibido correctamente tu pago.</p>

            <p>Detalles de la reserva:</p>

            <!-- DETALLES -->
            <div style="background-color: #f7f7f7; padding: 15px; border-radius: 6px;">
              <p><strong>Cliente:</strong> ${customerEmail || 'No disponible'}</p>
              <p><strong>Reserva:</strong> ${session.metadata?.descripcion || 'Sin descripción'}</p>
              <p><strong>Total pagado:</strong> ${session.amount_total / 100} THB</p>
            </div>

            <p style="margin-top: 20px;">
              Nuestro equipo está procesando tu reserva. En breve recibirás un correo adicional con la confirmación final y los detalles del servicio, incluidos los horarios de recogida.
            </p>

            <p>Quedamos a tu disposición para cualquier duda.</p>

            <!-- FOOTER -->
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />

            <div style="font-size: 13px; color: #555; text-align: center; line-height: 1.8;">
              
              <p><strong>Olé Tours Samui</strong></p>

              <p>
                <a href="https://www.oletoursamui.com" style="color:#0a7cff; text-decoration:none;">
                  www.oletoursamui.com
                </a>
              </p>

              <p>
                <a href="mailto:info@oletoursamui.com" style="color:#0a7cff; text-decoration:none;">
                  info@oletoursamui.com
                </a>
              </p>

              <p>
                <a href="https://wa.me/660925792007" style="color:#25D366; text-decoration:none;">
                  WhatsApp
                </a>
              </p>

              <p>
                <a href="https://www.instagram.com/oletours_samui/" style="color:#0a7cff; text-decoration:none;">
                  Instagram
                </a>
              </p>

            </div>

          </div>
        `
      });

      console.log('📧 Email enviado correctamente');

    } catch (error) {
      console.error('❌ Error enviando email:', error);
    }
  }

  // 👉 RESPUESTA SIEMPRE AL FINAL
  res.status(200).json({ received: true });
});


// 🔥 ESTO VA DESPUÉS DEL WEBHOOK
app.use(express.json());


// 👉 TU ENDPOINT ORIGINAL
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

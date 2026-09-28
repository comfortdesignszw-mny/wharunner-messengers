import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { betterAuth } from 'better-auth';
import { toNodeHandler } from 'better-auth/node';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { twoFactor } from 'better-auth/plugins';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();

// Ensure data directory
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// -------------------------------------------------------------
// Better Auth - TypeScript Authentication Framework
// -------------------------------------------------------------
const authStoreFile = path.resolve(dataDir, 'better-auth-store.json');
let authDb: Record<string, any[]> = {
  user: [],
  session: [],
  account: [],
  verification: [],
  twoFactor: [],
};

if (fs.existsSync(authStoreFile)) {
  try {
    const raw = fs.readFileSync(authStoreFile, 'utf8');
    const parsed = JSON.parse(raw);
    authDb = { ...authDb, ...parsed };
  } catch (err) {
    console.error('Error loading Better Auth persistent store:', err);
  }
}

export function persistAuthDb() {
  try {
    fs.writeFileSync(authStoreFile, JSON.stringify(authDb, null, 2));
  } catch (err) {
    console.error('Failed to write Better Auth store:', err);
  }
}
setInterval(persistAuthDb, 8000);
process.on('SIGTERM', persistAuthDb);
process.on('SIGINT', persistAuthDb);

export const auth = betterAuth({
  database: memoryAdapter(authDb),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    twoFactor({
      issuer: 'WhaRunner Messenger',
    }),
  ],
  trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://0.0.0.0:3000'],
  secret: process.env.BETTER_AUTH_SECRET || 'wharunner-better-auth-production-secret-key-32chars',
});

// Seed initial Better Auth demo users
async function seedBetterAuthUsers() {
  if (authDb.user.length === 0) {
    console.log('Seeding demo accounts into Better Auth...');
    try {
      await auth.api.signUpEmail({
        body: {
          name: 'Admin Officer',
          email: 'admin@wharunner.co.zw',
          password: 'Admin12345!',
        },
      });
      await auth.api.signUpEmail({
        body: {
          name: 'Blessing Runner',
          email: 'runner@wharunner.co.zw',
          password: 'Runner12345!',
        },
      });
      await auth.api.signUpEmail({
        body: {
          name: 'Chipo Customer',
          email: 'customer@wharunner.co.zw',
          password: 'Customer12345!',
        },
      });
      persistAuthDb();
      console.log('Better Auth default accounts seeded.');
    } catch (e) {
      console.error('Failed to seed default Better Auth accounts:', e);
    }
  }
}
seedBetterAuthUsers().catch(console.error);

// Mount Better Auth endpoints
app.all('/api/auth/*', toNodeHandler(auth));
app.all('/api/auth', toNodeHandler(auth));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Ensure uploads directory
const uploadsDir = path.resolve(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Initialize PGlite Postgres
const db = new PGlite(path.resolve(dataDir, 'pgdata'));


async function initDb() {
  console.log('Initializing Postgres tables with PGlite...');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messengers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      photo_url TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL,
      transport_mode TEXT NOT NULL,
      transport_photo_urls TEXT[] NOT NULL DEFAULT '{}',
      area_name TEXT NOT NULL,
      centre_lat DOUBLE PRECISION NOT NULL,
      centre_lng DOUBLE PRECISION NOT NULL,
      radius_km DOUBLE PRECISION NOT NULL DEFAULT 5.0,
      rating_avg DOUBLE PRECISION NOT NULL DEFAULT 5.0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      errands_completed INTEGER NOT NULL DEFAULT 0,
      errands_accepted INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      national_id_front TEXT,
      national_id_back TEXT,
      driver_licence_front TEXT,
      driver_licence_back TEXT,
      is_verified BOOLEAN NOT NULL DEFAULT false,
      kyc_status TEXT NOT NULL DEFAULT 'pending',
      kyc_notes TEXT DEFAULT '',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE messengers ADD COLUMN IF NOT EXISTS national_id_front TEXT;
    ALTER TABLE messengers ADD COLUMN IF NOT EXISTS national_id_back TEXT;
    ALTER TABLE messengers ADD COLUMN IF NOT EXISTS driver_licence_front TEXT;
    ALTER TABLE messengers ADD COLUMN IF NOT EXISTS driver_licence_back TEXT;
    ALTER TABLE messengers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE messengers ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE messengers ADD COLUMN IF NOT EXISTS kyc_notes TEXT DEFAULT '';

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      errand_type TEXT NOT NULL,
      orderer_name TEXT NOT NULL,
      orderer_whatsapp TEXT NOT NULL,
      shop_name TEXT,
      item_list TEXT[] NOT NULL DEFAULT '{}',
      budget DOUBLE PRECISION,
      product_image_url TEXT,
      parcel_description TEXT,
      pickup_address TEXT NOT NULL,
      pickup_lat DOUBLE PRECISION NOT NULL,
      pickup_lng DOUBLE PRECISION NOT NULL,
      pickup_contact_person TEXT,
      delivery_address TEXT NOT NULL,
      delivery_lat DOUBLE PRECISION NOT NULL,
      delivery_lng DOUBLE PRECISION NOT NULL,
      delivery_contact_person TEXT,
      scheduled_datetime TEXT NOT NULL,
      proposed_charge DOUBLE PRECISION NOT NULL,
      counter_charge DOUBLE PRECISION,
      agreed_charge DOUBLE PRECISION,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      messenger_id TEXT REFERENCES messengers(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE orders ADD COLUMN IF NOT EXISTS parcel_description TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_contact_person TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_contact_person TEXT;

    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      messenger_id TEXT NOT NULL REFERENCES messengers(id),
      stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
      comment TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    UPDATE messengers SET is_verified = true, kyc_status = 'verified' WHERE id LIKE 'zim-m-%' AND (is_verified IS NULL OR is_verified = false);
  `);




  // Check if we need to seed Zimbabwean messengers
  const check = await db.query<{ count: string }>('SELECT count(*) as count FROM messengers');
  if (parseInt(check.rows[0]?.count || '0', 10) === 0) {
    console.log('Seeding initial Zimbabwe Messengers...');
    const seedMessengers = [
      {
        id: 'zim-m-1',
        name: 'Tendai Moyo',
        photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
        whatsapp_number: '+263772849102',
        transport_mode: 'motorbike',
        transport_photo_urls: ['https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=400&auto=format&fit=crop&q=80'],
        area_name: 'Harare CBD & Avenues',
        centre_lat: -17.8292,
        centre_lng: 31.0522,
        radius_km: 7.5,
        rating_avg: 4.9,
        rating_count: 58,
        errands_completed: 142,
        errands_accepted: 145,
        is_active: true,
      },
      {
        id: 'zim-m-2',
        name: 'Blessing Chiweda',
        photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
        whatsapp_number: '+263719438921',
        transport_mode: 'bicycle',
        transport_photo_urls: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400&auto=format&fit=crop&q=80'],
        area_name: 'Avondale & Belgravia',
        centre_lat: -17.7944,
        centre_lng: 31.0367,
        radius_km: 5.0,
        rating_avg: 5.0,
        rating_count: 34,
        errands_completed: 89,
        errands_accepted: 91,
        is_active: true,
      },
      {
        id: 'zim-m-3',
        name: 'Farai Mataranyika',
        photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
        whatsapp_number: '+263773190844',
        transport_mode: 'car',
        transport_photo_urls: ['https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=400&auto=format&fit=crop&q=80'],
        area_name: "Borrowdale & Sam Levy's",
        centre_lat: -17.7554,
        centre_lng: 31.0886,
        radius_km: 12.0,
        rating_avg: 4.8,
        rating_count: 82,
        errands_completed: 210,
        errands_accepted: 215,
        is_active: true,
      },
      {
        id: 'zim-m-4',
        name: 'Ruvimbo Ndlovu',
        photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
        whatsapp_number: '+263782559012',
        transport_mode: 'public/kombi',
        transport_photo_urls: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&auto=format&fit=crop&q=80'],
        area_name: 'Mbare Musika & Southerton',
        centre_lat: -17.8596,
        centre_lng: 31.0428,
        radius_km: 8.0,
        rating_avg: 4.95,
        rating_count: 67,
        errands_completed: 175,
        errands_accepted: 178,
        is_active: true,
      },
      {
        id: 'zim-m-5',
        name: 'Tinashe Gumbo',
        photo_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80',
        whatsapp_number: '+263775908234',
        transport_mode: 'motorbike',
        transport_photo_urls: ['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=400&auto=format&fit=crop&q=80'],
        area_name: 'Chitungwiza (Makoni & Unit L)',
        centre_lat: -18.0125,
        centre_lng: 31.0667,
        radius_km: 10.0,
        rating_avg: 4.7,
        rating_count: 29,
        errands_completed: 64,
        errands_accepted: 66,
        is_active: true,
      },
      {
        id: 'zim-m-6',
        name: 'Sipho Sibanda',
        photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
        whatsapp_number: '+263774889012',
        transport_mode: 'bicycle',
        transport_photo_urls: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400&auto=format&fit=crop&q=80'],
        area_name: 'Bulawayo CBD & Hillside',
        centre_lat: -20.1619,
        centre_lng: 28.5833,
        radius_km: 7.0,
        rating_avg: 5.0,
        rating_count: 41,
        errands_completed: 93,
        errands_accepted: 94,
        is_active: true,
      },
    ];

    for (const m of seedMessengers) {
      await db.query(
        `INSERT INTO messengers (
          id, name, photo_url, whatsapp_number, transport_mode,
          transport_photo_urls, area_name, centre_lat, centre_lng,
          radius_km, rating_avg, rating_count, errands_completed,
          errands_accepted, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          m.id,
          m.name,
          m.photo_url,
          m.whatsapp_number,
          m.transport_mode,
          m.transport_photo_urls,
          m.area_name,
          m.centre_lat,
          m.centre_lng,
          m.radius_km,
          m.rating_avg,
          m.rating_count,
          m.errands_completed,
          m.errands_accepted,
          m.is_active,
        ]
      );
    }
    console.log('Seeded 6 Zimbabwean messengers.');
  }
}

// REST API ROUTES

// 1. GET /api/messengers
app.get('/api/messengers', async (req, res) => {
  try {
    const { area, transport, min_rating, active_only, verified_only } = req.query;
    let query = 'SELECT * FROM messengers WHERE 1=1';
    const params: any[] = [];

    if (active_only !== 'false') {
      params.push(true);
      query += ` AND is_active = $${params.length}`;
    }

    // By default, only verified messengers appear on the home page and errand booking list
    if (verified_only !== 'false') {
      params.push(true);
      query += ` AND is_verified = $${params.length}`;
    }

    if (area && area !== 'all') {
      params.push(`%${area}%`);
      query += ` AND area_name ILIKE $${params.length}`;
    }

    if (transport && transport !== 'all') {
      params.push(transport);
      query += ` AND transport_mode = $${params.length}`;
    }

    if (min_rating) {
      params.push(parseFloat(min_rating as string));
      query += ` AND rating_avg >= $${params.length}`;
    }

    query += ' ORDER BY rating_avg DESC, errands_completed DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Failed to fetch messengers:', error);
    res.status(500).json({ error: error.message || 'Database error' });
  }
});

// 2. GET /api/messengers/:id
app.get('/api/messengers/:id', async (req, res) => {
  try {
    const messengerResult = await db.query<any>('SELECT * FROM messengers WHERE id = $1', [req.params.id]);
    if (messengerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Messenger not found' });
    }

    const ratingsResult = await db.query<any>(
      'SELECT * FROM ratings WHERE messenger_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.params.id]
    );

    res.json({
      ...(messengerResult.rows[0] as object),
      ratings: ratingsResult.rows,
    });
  } catch (error: any) {
    console.error('Failed to fetch messenger profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. POST /api/messengers (Onboarding with KYC Verification)
app.post('/api/messengers', async (req, res) => {
  try {
    const {
      name,
      photo_url,
      whatsapp_number,
      transport_mode,
      transport_photo_urls,
      area_name,
      centre_lat,
      centre_lng,
      radius_km,
      national_id_front,
      national_id_back,
      driver_licence_front,
      driver_licence_back,
    } = req.body;

    if (!name || !whatsapp_number || !transport_mode || !area_name) {
      return res.status(400).json({ error: 'Missing required onboarding profile fields' });
    }

    // National ID Card is MANDATORY for all messengers
    if (!national_id_front || !national_id_back) {
      return res.status(400).json({
        error: 'National ID card (both front and back photos) is mandatory for runner onboarding KYC.',
      });
    }

    // Drivers licence is MANDATORY for vehicles (motorbikes, cars), exempted for non-vehicle (bicycle, foot, kombi)
    const requiresDriversLicence = transport_mode === 'motorbike' || transport_mode === 'car';
    if (requiresDriversLicence && (!driver_licence_front || !driver_licence_back)) {
      return res.status(400).json({
        error: "Driver's Licence (both front and back photos) is mandatory for runners with vehicles or motorbikes.",
      });
    }

    const id = 'zim-m-' + Math.random().toString(36).substring(2, 9);
    const cleanWhatsapp = whatsapp_number.startsWith('+') ? whatsapp_number : `+${whatsapp_number}`;
    const defaultPhoto = photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';

    await db.query(
      `INSERT INTO messengers (
        id, name, photo_url, whatsapp_number, transport_mode,
        transport_photo_urls, area_name, centre_lat, centre_lng,
        radius_km, rating_avg, rating_count, errands_completed,
        errands_accepted, is_active, national_id_front, national_id_back,
        driver_licence_front, driver_licence_back, is_verified, kyc_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 5.0, 0, 0, 0, true, $11, $12, $13, $14, false, 'pending')`,
      [
        id,
        name,
        defaultPhoto,
        cleanWhatsapp,
        transport_mode,
        transport_photo_urls || [],
        area_name,
        centre_lat || -17.8292,
        centre_lng || 31.0522,
        radius_km || 5.0,
        national_id_front,
        national_id_back,
        driver_licence_front || null,
        driver_licence_back || null,
      ]
    );

    const created = await db.query('SELECT * FROM messengers WHERE id = $1', [id]);
    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    console.error('Failed to register messenger:', error);
    res.status(500).json({ error: error.message });
  }
});


// 4. PATCH /api/messengers/:id
app.patch('/api/messengers/:id', async (req, res) => {
  try {
    const { name, whatsapp_number, transport_mode, area_name, is_active, radius_km } = req.body;
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      values.push(name);
      updates.push(`name = $${values.length}`);
    }
    if (whatsapp_number !== undefined) {
      values.push(whatsapp_number);
      updates.push(`whatsapp_number = $${values.length}`);
    }
    if (transport_mode !== undefined) {
      values.push(transport_mode);
      updates.push(`transport_mode = $${values.length}`);
    }
    if (area_name !== undefined) {
      values.push(area_name);
      updates.push(`area_name = $${values.length}`);
    }
    if (radius_km !== undefined) {
      values.push(radius_km);
      updates.push(`radius_km = $${values.length}`);
    }
    if (is_active !== undefined) {
      values.push(is_active);
      updates.push(`is_active = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const query = `UPDATE messengers SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Messenger not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Failed to update messenger:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. GET /api/messengers/:id/stats
app.get('/api/messengers/:id/stats', async (req, res) => {
  try {
    const messengerResult = await db.query<any>('SELECT * FROM messengers WHERE id = $1', [req.params.id]);
    if (messengerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Messenger not found' });
    }
    const m = messengerResult.rows[0];

    const ordersSum = await db.query<{ total: string; active: string }>(
      `SELECT 
        COALESCE(SUM(COALESCE(agreed_charge, proposed_charge)), 0) as total,
        COUNT(CASE WHEN status IN ('pending', 'negotiating', 'accepted', 'in_progress') THEN 1 END) as active
       FROM orders WHERE messenger_id = $1 AND status = 'completed'`,
      [req.params.id]
    );

    const acceptanceRate = m.errands_accepted > 0 && (m.errands_completed + 5) > 0
      ? Math.min(100, Math.round((m.errands_accepted / (m.errands_accepted + 2)) * 100))
      : 98;

    res.json({
      errands_completed: m.errands_completed,
      errands_accepted: m.errands_accepted,
      acceptance_rate: acceptanceRate,
      rating_avg: m.rating_avg,
      rating_count: m.rating_count,
      total_earnings_usd: parseFloat(ordersSum.rows[0]?.total || '0'),
      active_orders_count: parseInt(ordersSum.rows[0]?.active || '0', 10),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// 6. GET /api/messengers/:id/orders
app.get('/api/messengers/:id/orders', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM orders WHERE messenger_id = $1 ORDER BY 
        CASE 
          WHEN status = 'pending' THEN 1
          WHEN status = 'negotiating' THEN 2
          WHEN status = 'accepted' THEN 3
          WHEN status = 'in_progress' THEN 4
          ELSE 5
        END, created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. POST /api/orders (Public - Guest order creation)
app.post('/api/orders', async (req, res) => {
  try {
    const {
      errand_type,
      orderer_name,
      orderer_whatsapp,
      shop_name,
      item_list,
      budget,
      product_image_url,
      parcel_description,
      pickup_address,
      pickup_lat,
      pickup_lng,
      pickup_contact_person,
      delivery_address,
      delivery_lat,
      delivery_lng,
      delivery_contact_person,
      scheduled_datetime,
      proposed_charge,
      notes,
      messenger_id,
    } = req.body;

    if (!errand_type || !orderer_name || !orderer_whatsapp || !pickup_address || !delivery_address || !proposed_charge) {
      return res.status(400).json({ error: 'Missing mandatory order fields' });
    }

    // Generate unguessable UUID for order
    const id = 'ord-' + crypto.randomUUID();

    await db.query(
      `INSERT INTO orders (
        id, errand_type, orderer_name, orderer_whatsapp,
        shop_name, item_list, budget, product_image_url,
        parcel_description, pickup_address, pickup_lat, pickup_lng, pickup_contact_person,
        delivery_address, delivery_lat, delivery_lng, delivery_contact_person,
        scheduled_datetime, proposed_charge, notes,
        status, messenger_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'pending', $21)`,
      [
        id,
        errand_type,
        orderer_name,
        orderer_whatsapp,
        shop_name || null,
        item_list || [],
        budget || null,
        product_image_url || null,
        parcel_description || null,
        pickup_address,
        pickup_lat || -17.8292,
        pickup_lng || 31.0522,
        pickup_contact_person || null,
        delivery_address,
        delivery_lat || -17.8292,
        delivery_lng || 31.0522,
        delivery_contact_person || null,
        scheduled_datetime || new Date().toISOString(),
        proposed_charge,
        notes || null,
        messenger_id || null,
      ]
    );


    const saved = await db.query(
      `SELECT o.*, m.name as messenger_name, m.whatsapp_number as messenger_whatsapp, m.photo_url as messenger_photo
       FROM orders o
       LEFT JOIN messengers m ON o.messenger_id = m.id
       WHERE o.id = $1`,
      [id]
    );

    res.status(201).json({
      success: true,
      order: saved.rows[0],
      status_url: `/order/${id}`,
    });
  } catch (error: any) {
    console.error('Failed to create order:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. GET /api/orders/:id (Guest status check with order UUID as token)
app.get('/api/orders/:id', async (req, res) => {
  try {
    const result = await db.query<any>(
      `SELECT o.*, 
              m.name as messenger_name, 
              m.whatsapp_number as messenger_whatsapp, 
              m.photo_url as messenger_photo,
              m.transport_mode as messenger_transport,
              m.rating_avg as messenger_rating
       FROM orders o
       LEFT JOIN messengers m ON o.messenger_id = m.id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const ratings = await db.query<any>('SELECT * FROM ratings WHERE order_id = $1', [req.params.id]);

    res.json({
      ...(result.rows[0] as object),
      rating: ratings.rows[0] || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. PATCH /api/orders/:id/accept (Messenger accepts with or without counter_charge)
app.patch('/api/orders/:id/accept', async (req, res) => {
  try {
    const { counter_charge } = req.body;
    const orderCheck = await db.query<any>('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderCheck.rows[0];

    let query: string;
    let params: any[];

    if (counter_charge !== undefined && counter_charge !== null && parseFloat(counter_charge) !== order.proposed_charge) {
      // Counter offer: status = negotiating
      query = `UPDATE orders SET status = 'negotiating', counter_charge = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`;
      params = [parseFloat(counter_charge), req.params.id];
    } else {
      // Accepted as proposed: status = accepted, agreed_charge = proposed_charge
      query = `UPDATE orders SET status = 'accepted', agreed_charge = proposed_charge, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`;
      params = [req.params.id];

      // Update messenger stats
      if (order.messenger_id) {
        await db.query('UPDATE messengers SET errands_accepted = errands_accepted + 1 WHERE id = $1', [order.messenger_id]);
      }
    }

    const updated = await db.query<any>(query, params);
    res.json(updated.rows[0]);
  } catch (error: any) {
    console.error('Accept error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10. PATCH /api/orders/:id/reject (Messenger rejects)
app.patch('/api/orders/:id/reject', async (req, res) => {
  try {
    const updated = await db.query<any>(
      `UPDATE orders SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(updated.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11. PATCH /api/orders/:id/counter (Orderer counter negotiation)
// Can accept counter charge or propose new charge
app.patch('/api/orders/:id/counter', async (req, res) => {
  try {
    const { action, proposed_charge } = req.body; // action: 'accept' | 'propose'
    const orderCheck = await db.query<any>('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderCheck.rows[0];

    if (action === 'accept') {
      // Orderer accepts the counter_charge
      const agreed = order.counter_charge || order.proposed_charge;
      const updated = await db.query<any>(
        `UPDATE orders SET status = 'accepted', agreed_charge = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [agreed, req.params.id]
      );
      if (order.messenger_id) {
        await db.query('UPDATE messengers SET errands_accepted = errands_accepted + 1 WHERE id = $1', [order.messenger_id]);
      }
      return res.json(updated.rows[0]);
    } else if (action === 'propose' && proposed_charge) {
      // Orderer submits new counter-charge, status loops back to negotiating
      const updated = await db.query<any>(
        `UPDATE orders SET status = 'negotiating', proposed_charge = $1, counter_charge = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [parseFloat(proposed_charge), req.params.id]
      );
      return res.json(updated.rows[0]);
    } else {
      return res.status(400).json({ error: 'Invalid negotiation action or missing proposed_charge' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12. PATCH /api/orders/:id/status (Messenger marks in_progress / completed)
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updated = await db.query<any>(
      `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (status === 'completed' && updated.rows[0].messenger_id) {
      await db.query(
        'UPDATE messengers SET errands_completed = errands_completed + 1 WHERE id = $1',
        [updated.rows[0].messenger_id]
      );
    }

    res.json(updated.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 13. POST /api/orders/:id/rating (Orderer rates completed errand)
app.post('/api/orders/:id/rating', async (req, res) => {
  try {
    const { stars, comment } = req.body;
    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'Stars must be between 1 and 5' });
    }

    const orderRes = await db.query<any>('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderRes.rows[0];

    if (!order.messenger_id) {
      return res.status(400).json({ error: 'Order has no assigned messenger' });
    }

    const ratingId = 'rat-' + crypto.randomUUID();
    await db.query(
      `INSERT INTO ratings (id, order_id, messenger_id, stars, comment) VALUES ($1, $2, $3, $4, $5)`,
      [ratingId, req.params.id, order.messenger_id, parseInt(stars, 10), comment || null]
    );

    // Recalculate average rating for messenger
    const avgRes = await db.query<{ avg: string; cnt: string }>(
      'SELECT AVG(stars) as avg, COUNT(*) as cnt FROM ratings WHERE messenger_id = $1',
      [order.messenger_id]
    );

    const newAvg = parseFloat(avgRes.rows[0]?.avg || '5.0');
    const newCnt = parseInt(avgRes.rows[0]?.cnt || '1', 10);

    await db.query(
      'UPDATE messengers SET rating_avg = ROUND($1::numeric, 2), rating_count = $2 WHERE id = $3',
      [newAvg, newCnt, order.messenger_id]
    );

    res.status(201).json({ success: true, ratingId, rating_avg: newAvg });
  } catch (error: any) {
    console.error('Rating error:', error);
    res.status(500).json({ error: error.message });
  }
});


// 14. GET /api/admin/stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const messengersCount = await db.query<{ total: string; active: string }>(
      `SELECT COUNT(*) as total, COUNT(CASE WHEN is_active THEN 1 END) as active FROM messengers`
    );

    const ordersCount = await db.query<{ total: string; completed_value: string }>(
      `SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(agreed_charge, proposed_charge) ELSE 0 END), 0) as completed_value FROM orders`
    );

    const statusCounts = await db.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM orders GROUP BY status`
    );

    const ordersByStatus: Record<string, number> = {
      pending: 0,
      negotiating: 0,
      accepted: 0,
      in_progress: 0,
      completed: 0,
      rejected: 0,
      cancelled: 0,
    };

    for (const row of statusCounts.rows) {
      ordersByStatus[row.status] = parseInt(row.count, 10);
    }

    const totalMessengers = parseInt(messengersCount.rows[0]?.total || '0', 10);
    const activeMessengers = parseInt(messengersCount.rows[0]?.active || '0', 10);

    res.json({
      total_messengers: totalMessengers,
      active_messengers: activeMessengers,
      inactive_messengers: totalMessengers - activeMessengers,
      total_orders: parseInt(ordersCount.rows[0]?.total || '0', 10),
      orders_by_status: ordersByStatus,
      total_completed_value_usd: parseFloat(ordersCount.rows[0]?.completed_value || '0'),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 15. PATCH /api/admin/messengers/:id/deactivate
app.patch('/api/admin/messengers/:id/deactivate', async (req, res) => {
  try {
    const { is_active } = req.body;
    const result = await db.query(
      'UPDATE messengers SET is_active = $1 WHERE id = $2 RETURNING *',
      [is_active === undefined ? false : Boolean(is_active), req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Messenger not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 16. GET /api/admin/messengers (Fetch all runners including pending/unverified for KYC review)
app.get('/api/admin/messengers', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM messengers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error: any) {
    console.error('Failed to fetch admin messengers:', error);
    res.status(500).json({ error: error.message });
  }
});

// 17. PATCH /api/admin/messengers/:id/kyc (Admin analyzes & verifies/rejects KYC)
app.patch('/api/admin/messengers/:id/kyc', async (req, res) => {
  try {
    const { is_verified, kyc_status, kyc_notes } = req.body;
    const updates: string[] = [];
    const values: any[] = [];

    if (is_verified !== undefined) {
      values.push(Boolean(is_verified));
      updates.push(`is_verified = $${values.length}`);
    }
    if (kyc_status !== undefined) {
      values.push(kyc_status);
      updates.push(`kyc_status = $${values.length}`);
    }
    if (kyc_notes !== undefined) {
      values.push(kyc_notes);
      updates.push(`kyc_notes = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No KYC fields provided to update' });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE messengers SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Messenger not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Failed to update messenger KYC:', error);
    res.status(500).json({ error: error.message });
  }
});

// 18. POST /api/upload (Client image upload endpoint)
app.post('/api/upload', async (req, res) => {

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }
    // Return compressed base64 or file URL
    res.json({ url: imageBase64 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Initialize DB and launch server
initDb()
  .then(async () => {
    // Vite middleware integration
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(__dirname, 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }

    const portNum = Number(PORT) || 3000;
    app.listen(portNum, '0.0.0.0', () => {
      console.log(`WhaRunner server running on http://0.0.0.0:${portNum}`);
    });

  })
  .catch((err) => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });

/**
 * setup-supabase.js
 * Run this ONCE to:
 *  1. Create the 'product-images' storage bucket
 *  2. Set bucket to public
 *  3. Create the admin user in Supabase Auth
 *
 * Usage:
 *   cd server
 *   node setup-supabase.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('\n🚀 Next Trace Logistics — Supabase Setup\n');
  console.log(`📡 Project: ${SUPABASE_URL}\n`);

  // ─── 1. CREATE STORAGE BUCKETS ────────────────────────────────────
  const buckets = [
    { name: 'product-images', public: true },
    { name: 'shipment-documents', public: false },
    { name: 'courier-avatars', public: true },
  ];

  for (const bucket of buckets) {
    const { data: existing } = await supabase.storage.getBucket(bucket.name);
    if (existing) {
      console.log(`✅ Bucket '${bucket.name}' already exists — skipping.`);
      continue;
    }

    const { data, error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      allowedMimeTypes: bucket.name.includes('image') || bucket.name.includes('avatar')
        ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        : ['application/pdf', 'image/jpeg', 'image/png'],
      fileSizeLimit: bucket.name.includes('document') ? 10 * 1024 * 1024 : 5 * 1024 * 1024, // 10MB docs, 5MB images
    });

    if (error) {
      console.error(`❌ Failed to create bucket '${bucket.name}':`, error.message);
    } else {
      console.log(`✅ Created bucket '${bucket.name}' (${bucket.public ? 'public' : 'private'})`);
    }
  }

  // ─── 2. CREATE ADMIN USER IN SUPABASE AUTH ─────────────────────────
  console.log('\n─── Creating Admin User ───────────────────────────────');

  const ADMIN_EMAIL = 'nexttracelogistics@gmail.com';
  const ADMIN_PASSWORD = 'Black123$$roman'; // Change this after first login!

  // Check if user already exists
  const { data: existingUsers, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('❌ Could not list users:', listErr.message);
  } else {
    const already = existingUsers.users.find(u => u.email === ADMIN_EMAIL);
    if (already) {
      console.log(`✅ Admin user '${ADMIN_EMAIL}' already exists (ID: ${already.id})`);
    } else {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true, // Skip email confirmation
        user_metadata: {
          full_name: 'Next Trace Admin',
          phone: '+1 (307) 200-8344',
        },
      });

      if (createErr) {
        console.error(`❌ Failed to create admin user:`, createErr.message);
      } else {
        console.log(`✅ Created admin user: ${ADMIN_EMAIL} (ID: ${newUser.user.id})`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);
        console.log(`   ⚠️  IMPORTANT: Change this password after your first login!`);
      }
    }
  }

  // ─── 3. VERIFY BUCKET POLICIES ─────────────────────────────────────
  console.log('\n─── Storage Bucket Summary ────────────────────────────');
  const { data: allBuckets } = await supabase.storage.listBuckets();
  if (allBuckets) {
    allBuckets.forEach(b => {
      console.log(`  📦 ${b.name} — ${b.public ? '🌐 public' : '🔒 private'}`);
    });
  }

  console.log('\n✅ Supabase setup complete!\n');
  console.log('📋 Next steps:');
  console.log('   1. Run the schema SQL in the Supabase SQL Editor (supabase_schema.sql)');
  console.log('   2. Start the server: cd server && node index.js');
  console.log('   3. Start the frontend: npm run dev');
  console.log(`   4. Login at /dashboard with: ${ADMIN_EMAIL}`);
  console.log('   5. Change your admin password in Settings → Security\n');
}

run().catch(err => {
  console.error('💥 Setup failed:', err.message);
  process.exit(1);
});

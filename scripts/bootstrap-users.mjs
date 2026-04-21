import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function stripOptionalQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFileIntoProcess(filename) {
  const filepath = resolve(process.cwd(), filename);
  if (!existsSync(filepath)) return;
  const raw = readFileSync(filepath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) return;
    const key = trimmed.slice(0, separator).trim();
    if (!key) return;
    if (process.env[key]) return;
    const value = stripOptionalQuotes(trimmed.slice(separator + 1));
    process.env[key] = value;
  });
}

loadEnvFileIntoProcess('.env');
loadEnvFileIntoProcess('.env.local');
loadEnvFileIntoProcess('.env.example');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function optional(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

async function findUserByEmail(adminClient, email) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list users: ${error.message}`);

    const users = data.users || [];
    const found = users.find((entry) => entry.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function ensureAuthUser(adminClient, input) {
  const existing = await findUserByEmail(adminClient, input.email);

  if (existing) {
    const { data, error } = await adminClient.auth.admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
      },
    });
    if (error) throw new Error(`Failed to update user ${input.email}: ${error.message}`);
    return data.user;
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
    },
  });
  if (error || !data.user) {
    throw new Error(`Failed to create user ${input.email}: ${error?.message || 'Unknown error'}`);
  }
  return data.user;
}

async function ensureBusiness(dbClient, superAdminUserId, businessName) {
  const existing = await dbClient
    .from('businesses')
    .select('id')
    .eq('name', businessName)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Failed to query business: ${existing.error.message}`);
  }
  if (existing.data?.id) return existing.data.id;

  const created = await dbClient
    .from('businesses')
    .insert({
      name: businessName,
      legal_name: businessName,
      created_by: superAdminUserId,
    })
    .select('id')
    .single();

  if (created.error || !created.data?.id) {
    throw new Error(`Failed to create business: ${created.error?.message || 'Unknown error'}`);
  }
  return created.data.id;
}

async function ensureMembership(dbClient, input) {
  const existing = await dbClient
    .from('business_users')
    .select('id, role')
    .eq('business_id', input.businessId)
    .eq('user_id', input.userId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Failed to query membership (${input.email}): ${existing.error.message}`);
  }

  if (existing.data?.id) {
    const updated = await dbClient
      .from('business_users')
      .update({
        role: input.role,
        is_active: true,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.data.id);

    if (updated.error) {
      throw new Error(`Failed to update membership (${input.email}): ${updated.error.message}`);
    }
    return;
  }

  const inserted = await dbClient.from('business_users').insert({
    business_id: input.businessId,
    user_id: input.userId,
    role: input.role,
    is_active: true,
    invited_at: new Date().toISOString(),
    accepted_at: new Date().toISOString(),
    created_by: input.createdBy,
  });

  if (inserted.error) {
    throw new Error(`Failed to create membership (${input.email}): ${inserted.error.message}`);
  }
}

async function main() {
  const supabaseUrl = required('SUPABASE_URL');
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');

  const superAdminEmail = optional('SUPERADMIN_EMAIL', 'accounts@develogic-digital.com');
  const superAdminPassword = required('SUPERADMIN_PASSWORD');
  const accountantEmail = optional('ACCOUNTANT_ADMIN_EMAIL', 'accountant@develogic-digital.com');
  const accountantPassword = required('ACCOUNTANT_ADMIN_PASSWORD');
  const businessName = optional('BUSINESS_NAME', 'DeveLogic Digital');

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const superAdmin = await ensureAuthUser(adminClient, {
    email: superAdminEmail,
    password: superAdminPassword,
    fullName: 'DeveLogic Super Admin',
  });
  const accountantAdmin = await ensureAuthUser(adminClient, {
    email: accountantEmail,
    password: accountantPassword,
    fullName: 'DeveLogic Accountant Admin',
  });

  const businessId = await ensureBusiness(adminClient, superAdmin.id, businessName);

  await ensureMembership(adminClient, {
    businessId,
    userId: superAdmin.id,
    role: 'owner',
    email: superAdminEmail,
    createdBy: superAdmin.id,
  });
  await ensureMembership(adminClient, {
    businessId,
    userId: accountantAdmin.id,
    role: 'admin',
    email: accountantEmail,
    createdBy: superAdmin.id,
  });

  console.log('User bootstrap complete:');
  console.log(`- Business: ${businessName} (${businessId})`);
  console.log(`- Superadmin: ${superAdminEmail} (role: owner)`);
  console.log(`- Accountant admin: ${accountantEmail} (role: admin)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

import { authorize } from '../shared/authorization';
import { UserRole } from '../modules/auth/types';
import { encryptSession, decryptSession } from '../modules/auth/utils';

async function runTests() {
  console.log('Running authorization and role-based AI integration test suite...');

  const admin = { id: 'admin-1', role: UserRole.ADMIN };
  const manager = { id: 'mgr-1', role: UserRole.MANAGER };
  const receptionist = { id: 'rec-1', role: UserRole.RECEPTIONIST };
  const housekeeper = { id: 'hk-1', role: UserRole.HOUSEKEEPER };
  const customer = { id: 'cust-1', role: UserRole.CUSTOMER };

  // 1. Admin RBAC tests
  authorize(admin, 'room:create');
  authorize(admin, 'audit:view:all');
  authorize(admin, 'staff:create:manager');
  authorize(admin, 'staff:create:staff');
  authorize(admin, 'refund:approve');
  authorize(admin, 'housekeeping:view');
  authorize(admin, 'reports:view');

  // 2. Manager RBAC tests
  authorize(manager, 'room:create');
  authorize(manager, 'staff:create:staff');
  authorize(manager, 'refund:approve');
  authorize(manager, 'housekeeping:view');
  authorize(manager, 'reports:view');
  try {
    authorize(manager, 'audit:view:all');
    throw new Error('Manager should not be able to view all audits');
  } catch (e: any) {
    if (e.name !== 'ForbiddenError') throw e;
  }
  try {
    authorize(manager, 'staff:create:manager');
    throw new Error('Manager should not be able to create managers');
  } catch (e: any) {
    if (e.name !== 'ForbiddenError') throw e;
  }

  // 3. Receptionist RBAC tests
  authorize(receptionist, 'room:status:update');
  authorize(receptionist, 'booking:create:offline');
  try {
    authorize(receptionist, 'room:create');
    throw new Error('Receptionist should not be able to create rooms');
  } catch (e: any) {
    if (e.name !== 'ForbiddenError') throw e;
  }
  try {
    authorize(receptionist, 'reports:view');
    throw new Error('Receptionist should not be able to view reports');
  } catch (e: any) {
    if (e.name !== 'ForbiddenError') throw e;
  }

  // 4. Housekeeper RBAC tests
  authorize(housekeeper, 'room:status:update');
  authorize(housekeeper, 'housekeeping:view');
  try {
    authorize(housekeeper, 'booking:create:offline');
    throw new Error('Housekeeper should not be able to create offline bookings');
  } catch (e: any) {
    if (e.name !== 'ForbiddenError') throw e;
  }

  // 5. Customer RBAC tests
  try {
    authorize(customer, 'room:status:update');
    throw new Error('Customer should not be able to update room status');
  } catch (e: any) {
    if (e.name !== 'ForbiddenError') throw e;
  }

  // 6. Session encryption/decryption roundtrip across all UserRoles
  for (const role of [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.RECEPTIONIST,
    UserRole.HOUSEKEEPER,
    UserRole.CUSTOMER,
  ]) {
    const token = await encryptSession({ userId: `user-${role}`, role });
    const decoded = await decryptSession(token);
    if (!decoded || decoded.role !== role || decoded.userId !== `user-${role}`) {
      throw new Error(`Session roundtrip failed for role ${role}`);
    }
  }

  // 7. Edge case: invalid/empty session token returns null (defaults to GUEST in /api/chat)
  const guestSession = await decryptSession('');
  if (guestSession !== null) {
    throw new Error('Empty token should resolve to null (GUEST fallback)');
  }

  console.log('✅ All RBAC, session roundtrip, and role edge-case tests passed!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

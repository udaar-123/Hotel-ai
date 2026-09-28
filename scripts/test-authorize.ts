import { authorize } from '../shared/authorization';
import { UserRole } from '../modules/auth/types';

function testAuthorize() {
  const admin = { role: UserRole.ADMIN };
  const manager = { role: UserRole.MANAGER };
  const receptionist = { role: UserRole.RECEPTIONIST };
  const customer = { role: UserRole.CUSTOMER };

  // Admin tests
  authorize(admin, 'room:create');
  authorize(admin, 'audit:view:all');

  // Manager tests
  authorize(manager, 'room:create');
  try {
    authorize(manager, 'audit:view:all');
    throw new Error('Manager should not be able to view all audits');
  } catch (e: any) {
    if (e.name !== 'ForbiddenError') throw e;
  }

  // Receptionist tests
  authorize(receptionist, 'room:status:update');
  try {
    authorize(receptionist, 'room:create');
    throw new Error('Receptionist should not be able to create rooms');
  } catch (e: any) {
    if (e.name !== 'ForbiddenError') throw e;
  }

  // Customer tests
  try {
    authorize(customer, 'room:status:update');
    throw new Error('Customer should not be able to update room status');
  } catch (e: any) {
    if (e.name !== 'ForbiddenError') throw e;
  }

  console.log('✅ All authorize() tests passed');
}

testAuthorize();

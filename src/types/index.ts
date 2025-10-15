import { PAYMENT_DEPARTMENTS, AK_APPROVAL_OPTIONS } from "../lib/constants";

export interface Student {
  id: string;
  serialNumber: string;
  name: string;
  email: string;
  avatarUrl?: string;
  avatarFallback: string;
  zone: string;
  category: string;
  intakeYear: number;
  createdAt: string;
}

export type PaymentDepartment = typeof PAYMENT_DEPARTMENTS[number];
export type AkApprovalStatus = typeof AK_APPROVAL_OPTIONS[number];

interface BasePayment {
  id: string;
  studentId: string;
  date: string;
  amount: number;
  receivedIn: string;
}

export interface AccountingPayment extends BasePayment {
  department: 'Application';
  aksApproval: AkApprovalStatus;
  applicationRemarks?: string;
  aksRemarks?: string;
  accountingRemarks?: string;
}

export interface ExmPayment extends BasePayment {
  department: 'CIMEA';
  purpose: string;
  remarks?: string;
}

export interface HrdPayment extends BasePayment {
  department: 'Legal';
  purpose: string;
  remarks?: string;
}

export type Payment = AccountingPayment | ExmPayment | HrdPayment;

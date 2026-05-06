/**
 * Formats a date string to a user-friendly format
 * @param dateString - ISO date string or date string
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted date string
 */
export const formatDate = (
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original string if invalid date
    }
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.warn('Error formatting date:', error);
    return dateString; // Return original string on error
  }
};

/**
 * Formats a date string to a more detailed format with time
 * @param dateString - ISO date string or date string
 * @returns Formatted date and time string
 */
export const formatDateTime = (dateString: string): string => {
  return formatDate(dateString, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Formats a date string to a short format (MM/DD/YYYY)
 * @param dateString - ISO date string or date string
 * @returns Short formatted date string
 */
export const formatDateShort = (dateString: string): string => {
  return formatDate(dateString, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Calculates the next installment number for a given student and payment type
 * @param existingPayments - Array of existing payments for the student
 * @param paymentType - The payment type to calculate installment for
 * @returns The next installment number
 */
export const getNextInstallmentNumber = (
  existingPayments: Array<{ payment_type?: string }>,
  paymentType: string
): number => {
  const paymentsOfType = existingPayments.filter(p =>
    (p.payment_type || '').toLowerCase() === paymentType.toLowerCase()
  );
  return paymentsOfType.length + 1;
};

/**
 * Calculates installment numbers for a list of payments, grouped by payment type
 * @param payments - Array of payments to calculate installment numbers for
 * @returns Array of payments with installment numbers added
 */
export const addInstallmentNumbers = <T extends { payment_type?: string }>(
  payments: T[]
): (T & { installment_number: number })[] => {
  const paymentTypeCounts: Record<string, number> = {};

  return payments.map(payment => {
    const paymentType = (payment.payment_type || '').toLowerCase();
    paymentTypeCounts[paymentType] = (paymentTypeCounts[paymentType] || 0) + 1;

    return {
      ...payment,
      installment_number: paymentTypeCounts[paymentType]
    };
  });
};

/**
 * Parse associate_wise_installments string into array of installment amounts
 * @param installmentsStr - String like "15-25-40" (short form)
 * @returns Array of installment amounts
 */
export const parseInstallmentStructure = (installmentsStr: string | undefined): number[] => {
  if (!installmentsStr || typeof installmentsStr !== 'string') {
    return [];
  }
  const parts = installmentsStr.split('-').map(part => {
    const num = Number(part.trim());
    return Number.isNaN(num) ? 0 : num;
  });
  // Return as-is (no conversion)
  return parts.map(p => p);
};

/**
 * Calculate current progress per installment from existing payments
 * @param existingPayments - Array of payment records
 * @returns Map of installment_number -> total paid amount
 */
export const calculateInstallmentProgress = (
  existingPayments: Array<{ installment_number?: number; amount?: number }>
): Record<number, number> => {
  const progress: Record<number, number> = {};
  for (const payment of existingPayments || []) {
    const instNum = Number(payment.installment_number);
    if (Number.isInteger(instNum) && instNum > 0) {
      const amount = Number(payment.amount) || 0;
      progress[instNum] = (progress[instNum] || 0) + amount;
    }
  }
  return progress;
};

/**
 * Calculate waterfall distribution preview
 * @param depositAmount - Total deposit amount
 * @param installmentTargets - Array of target amounts per installment
 * @param existingProgress - Current progress per installment
 * @returns Array of distribution records
 */
export const calculateWaterfallPreview = (
  depositAmount: number,
  installmentTargets: number[],
  existingProgress: Record<number, number>,
  existingPayments: Array<{ installment_number?: number }>
): Array<{ installmentNumber: number; amount: number; target: number; alreadyPaid: number }> => {
  const distribution: Array<{ installmentNumber: number; amount: number; target: number; alreadyPaid: number }> = [];
  let remaining = depositAmount;

  for (let i = 0; i < installmentTargets.length && remaining > 0; i++) {
    const installmentNumber = i + 1;
    const target = installmentTargets[i];
    const alreadyPaid = existingProgress[installmentNumber] || 0;
    const needed = Math.max(0, target - alreadyPaid);

    // Check if installment already has 4 records (max constraint)
    const existingRecordsForInst = existingPayments.filter(
      p => Number(p.installment_number) === installmentNumber
    );

    if (needed <= 0 || existingRecordsForInst.length >= 4) {
      continue;
    }

    if (remaining >= needed) {
      distribution.push({
        installmentNumber,
        amount: needed,
        target,
        alreadyPaid
      });
      remaining -= needed;
    } else if (remaining > 0) {
      distribution.push({
        installmentNumber,
        amount: remaining,
        target,
        alreadyPaid
      });
      remaining = 0;
    }
  }

  return distribution;
};
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

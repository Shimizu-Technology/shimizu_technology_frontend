// Type definitions for PayPal SDK
interface Window {
  paypal: PayPalNamespace;
}

interface PayPalNamespace {
  Buttons: (options: PayPalButtonOptions) => PayPalButtonsInstance;
  CardNumberField: () => PayPalCardField;
  CardExpiryField: () => PayPalCardField;
  CardCvvField: () => PayPalCardField; // Note the capitalization - it's CvvField, not CVVField
  FUNDING: PayPalFunding;
}

interface PayPalFunding {
  PAYPAL: string;
  VENMO: string;
  PAYLATER: string;
  CARD: string;
}

interface PayPalButtonOptions {
  fundingSource?: string;
  style?: {
    layout?: 'vertical' | 'horizontal';
    color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
    shape?: 'rect' | 'pill';
    height?: number;
    label?: 'paypal' | 'checkout' | 'buynow' | 'pay' | 'installment';
  };
  createOrder?: () => Promise<string>;
  onApprove?: (data: PayPalApproveData, actions: PayPalActions) => Promise<void>;
  onCancel?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface PayPalButtonsInstance {
  render: (container: string | HTMLElement) => Promise<void>;
  close: () => void;
}

interface PayPalCardField {
  render: (container: string | HTMLElement) => Promise<void>;
  on: (
    event: 'validityChange' | 'cardTypeChange' | 'blur' | 'focus', 
    handler: (data: any) => void
  ) => void;
}

interface PayPalApproveData {
  orderID: string;
  payerID: string;
  paymentID?: string;
  billingToken?: string;
  facilitatorAccessToken?: string;
}

interface PayPalActions {
  order: {
    capture: () => Promise<PayPalCaptureResult>;
    authorize: () => Promise<any>;
    patch: () => Promise<any>;
    get: () => Promise<any>;
  };
  redirect: {
    toCheckout: () => void;
  };
}

interface PayPalCaptureResult {
  id: string;
  status: string;
  payer: any;
  purchase_units: any[];
  [key: string]: any;
}

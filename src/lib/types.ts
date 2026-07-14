export type Category = {
  id: string;
  name: string;
  slug: string;
  position: number;
  created_at: string;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string;
  price: number;
  price_old: number | null;
  tag: string | null;
  discount_label: string | null;
  image_url: string | null;
  active: boolean;
  stock: number | null;
  position: number;
  created_at: string;
  updated_at: string;
  categories?: Pick<Category, "id" | "name" | "slug"> | null;
};

export type OrderItem = {
  product_id: string;
  name: string;
  price: number;
  qty: number;
};

export type Order = {
  id: string;
  status: "pending" | "paid" | "rejected" | "cancelled";
  total: number;
  items: OrderItem[];
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  qty: number;
};

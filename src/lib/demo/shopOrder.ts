export type BlacklineDemoOrderSnapshot = {
  items: Array<{
    productId: string;
    name: string;
    unitPricePence: number;
    quantity: number;
    lineTotalPence: number;
    imageUrl: string;
  }>;
  totalPence: number;
  collectionMethod: 'Collect in shop';
  createdAt: string;
};

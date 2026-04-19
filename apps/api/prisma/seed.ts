import { PrismaClient, ProductCategory, StorageLocation, ExpirySource, ItemStatus } from "@prisma/client";

const prisma = new PrismaClient();

const addDays = (days: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
};

async function main() {
  await prisma.scanLog.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.product.deleteMany();

  const products = await Promise.all(
    [
      {
        barcode: "8801111111111",
        name: "서울우유 1L",
        brand: "서울우유",
        category: ProductCategory.dairy,
        imageUrl: "https://placehold.co/400x400?text=%EC%84%9C%EC%9A%B8%EC%9A%B0%EC%9C%A0",
      },
      {
        barcode: "8802222222222",
        name: "계란 10구",
        brand: "행복란",
        category: ProductCategory.egg,
        imageUrl: "https://placehold.co/400x400?text=%EA%B3%84%EB%9E%80",
      },
      {
        barcode: "8803333333333",
        name: "두부",
        brand: "풀무원",
        category: ProductCategory.tofu,
        imageUrl: "https://placehold.co/400x400?text=%EB%91%90%EB%B6%80",
      },
      {
        barcode: "8804444444444",
        name: "플레인 요거트",
        brand: "매일",
        category: ProductCategory.dairy,
        imageUrl: "https://placehold.co/400x400?text=%EC%9A%94%EA%B1%B0%ED%8A%B8",
      },
      {
        barcode: "8805555555555",
        name: "오렌지 주스",
        brand: "델몬트",
        category: ProductCategory.beverage,
        imageUrl: "https://placehold.co/400x400?text=%EC%98%A4%EB%A0%8C%EC%A7%80+%EC%A3%BC%EC%8A%A4",
      },
      {
        barcode: "8806666666666",
        name: "컵라면",
        brand: "농심",
        category: ProductCategory.instant_food,
        imageUrl: "https://placehold.co/400x400?text=%EC%BB%B5%EB%9D%BC%EB%A9%B4",
      },
      {
        barcode: "8807777777777",
        name: "샴푸",
        brand: "려",
        category: ProductCategory.personal_care,
        imageUrl: "https://placehold.co/400x400?text=%EC%83%B4%ED%91%B8",
      },
      {
        barcode: "8808888888888",
        name: "휴지",
        brand: "크리넥스",
        category: ProductCategory.paper_goods,
        imageUrl: "https://placehold.co/400x400?text=%ED%9C%B4%EC%A7%80",
      },
      {
        barcode: "8809999999999",
        name: "세제",
        brand: "피죤",
        category: ProductCategory.cleaning,
        imageUrl: "https://placehold.co/400x400?text=%EC%84%B8%EC%A0%9C",
      },
      {
        barcode: "8801234567890",
        name: "냉동 만두",
        brand: "비비고",
        category: ProductCategory.frozen_food,
        imageUrl: "https://placehold.co/400x400?text=%EB%83%89%EB%8F%99+%EB%A7%8C%EB%91%90",
      },
    ].map((product) =>
      prisma.product.create({
        data: product,
      }),
    ),
  );

  const productByBarcode = new Map(products.map((product) => [product.barcode, product]));

  const requireProduct = (barcode: string) => {
    const product = productByBarcode.get(barcode);

    if (!product) {
      throw new Error(`Seed product not found for barcode ${barcode}`);
    }

    return product;
  };

  await prisma.inventoryItem.createMany({
    data: [
      {
        ownerKey: "demo-user",
        productId: requireProduct("8801111111111").id,
        barcode: "8801111111111",
        displayName: "서울우유 1L",
        brand: "서울우유",
        category: ProductCategory.dairy,
        quantity: 1,
        unit: "팩",
        storageLocation: StorageLocation.fridge,
        expiryDate: addDays(0),
        expirySource: ExpirySource.manual,
        status: ItemStatus.active,
        notes: "아침 시리얼용",
      },
      {
        ownerKey: "demo-user",
        productId: requireProduct("8802222222222").id,
        barcode: "8802222222222",
        displayName: "계란 10구",
        brand: "행복란",
        category: ProductCategory.egg,
        quantity: 1,
        unit: "판",
        storageLocation: StorageLocation.fridge,
        expiryDate: addDays(3),
        expirySource: ExpirySource.preset,
        status: ItemStatus.active,
        notes: "주말 브런치용",
      },
      {
        ownerKey: "demo-user",
        productId: requireProduct("8803333333333").id,
        barcode: "8803333333333",
        displayName: "두부",
        brand: "풀무원",
        category: ProductCategory.tofu,
        quantity: 2,
        unit: "모",
        storageLocation: StorageLocation.fridge,
        expiryDate: addDays(-1),
        expirySource: ExpirySource.manual,
        status: ItemStatus.expired,
        notes: "찌개용",
      },
      {
        ownerKey: "demo-user",
        productId: requireProduct("8804444444444").id,
        barcode: "8804444444444",
        displayName: "플레인 요거트",
        brand: "매일",
        category: ProductCategory.dairy,
        quantity: 1,
        unit: "통",
        storageLocation: StorageLocation.fridge,
        expiryDate: addDays(7),
        expirySource: ExpirySource.preset,
        status: ItemStatus.active,
        notes: "",
      },
      {
        ownerKey: "demo-user",
        productId: requireProduct("8805555555555").id,
        barcode: "8805555555555",
        displayName: "오렌지 주스",
        brand: "델몬트",
        category: ProductCategory.beverage,
        quantity: 1,
        unit: "병",
        storageLocation: StorageLocation.room,
        expiryDate: addDays(14),
        expirySource: ExpirySource.manual,
        status: ItemStatus.active,
        notes: "손님용",
      },
      {
        ownerKey: "demo-user",
        productId: requireProduct("8806666666666").id,
        barcode: "8806666666666",
        displayName: "컵라면",
        brand: "농심",
        category: ProductCategory.instant_food,
        quantity: 4,
        unit: "개",
        storageLocation: StorageLocation.kitchen,
        expiryDate: addDays(30),
        expirySource: ExpirySource.manual,
        status: ItemStatus.active,
        notes: "",
      },
      {
        ownerKey: "demo-user",
        productId: requireProduct("8807777777777").id,
        barcode: "8807777777777",
        displayName: "샴푸",
        brand: "려",
        category: ProductCategory.personal_care,
        quantity: 1,
        unit: "병",
        storageLocation: StorageLocation.bathroom,
        expiryDate: addDays(90),
        expirySource: ExpirySource.manual,
        status: ItemStatus.active,
        notes: "",
      },
      {
        ownerKey: "demo-user",
        productId: requireProduct("8801234567890").id,
        barcode: "8801234567890",
        displayName: "냉동 만두",
        brand: "비비고",
        category: ProductCategory.frozen_food,
        quantity: 1,
        unit: "봉",
        storageLocation: StorageLocation.freezer,
        expiryDate: addDays(2),
        expirySource: ExpirySource.preset,
        status: ItemStatus.active,
        notes: "야식 후보",
      },
      {
        ownerKey: "demo-user",
        productId: requireProduct("8808888888888").id,
        barcode: "8808888888888",
        displayName: "휴지",
        brand: "크리넥스",
        category: ProductCategory.paper_goods,
        quantity: 12,
        unit: "롤",
        storageLocation: StorageLocation.room,
        expiryDate: addDays(180),
        expirySource: ExpirySource.manual,
        status: ItemStatus.active,
        notes: "재구매 여유 있음",
      },
      {
        ownerKey: "demo-user",
        productId: requireProduct("8809999999999").id,
        barcode: "8809999999999",
        displayName: "세제",
        brand: "피죤",
        category: ProductCategory.cleaning,
        quantity: 1,
        unit: "통",
        storageLocation: StorageLocation.kitchen,
        expiryDate: addDays(120),
        expirySource: ExpirySource.manual,
        status: ItemStatus.consumed,
        notes: "리필 구매 예정",
      },
    ],
  });

  await prisma.notificationPreference.create({
    data: {
      ownerKey: "demo-user",
      enabled: true,
      reminderDaysBefore: [1, 3, 7],
      remindOnDayOf: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    },
  });

  await prisma.scanLog.createMany({
    data: [
      {
        ownerKey: "demo-user",
        barcode: "8801111111111",
        matched: true,
        note: "seeded_successful_lookup",
      },
      {
        ownerKey: "demo-user",
        barcode: "8800000000000",
        matched: false,
        note: "seeded_unknown_scan",
      },
      {
        ownerKey: "demo-user",
        barcode: "8800000000001",
        matched: false,
        note: "seeded_unknown_scan",
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

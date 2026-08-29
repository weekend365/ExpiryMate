import {
  AccountType,
  ExpirySource,
  InventoryUnitCode,
  ItemStatus,
  PrismaClient,
  ProductCategory,
  UserRole,
} from "@prisma/client";
import {
  addDays,
  recipeInventorySnapshotItemSchema,
  recipeRecommendationRequestSchema,
  recipeRecommendationsPayloadSchema,
} from "@expirymate/shared";
import argon2 from "argon2";

if (process.env.NODE_ENV === "production") {
  throw new Error("db:seed must not run in production — it wipes all tables.");
}

const prisma = new PrismaClient();

const seedDay = (daysFromToday: number) => addDays(new Date(), daysFromToday);

async function main() {
  await prisma.oneTimeAuthToken.deleteMany();
  await prisma.refreshSession.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.passwordCredential.deleteMany();
  await prisma.pushNotificationDelivery.deleteMany();
  await prisma.pushToken.deleteMany();
  await prisma.recipeFavorite.deleteMany();
  await prisma.recipeRecommendation.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.userStorageLocation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      id: "demo-user",
      accountType: AccountType.registered,
      role: UserRole.user,
      email: "demo@expirymate.local",
      displayName: "Demo User",
      emailVerifiedAt: new Date(),
    },
  });

  // Dedicated local/CI account for mobile layout smoke tests. Production
  // seeding is rejected at the top of this file.
  const e2eUserPassword = process.env.E2E_USER_PASSWORD ?? "demo1234!";
  const e2eUserId = "layout-e2e-user";
  await prisma.user.create({
    data: {
      id: e2eUserId,
      accountType: AccountType.registered,
      role: UserRole.user,
      email: "demo@gmail.com",
      displayName: "Layout E2E User",
      emailVerifiedAt: new Date(),
      passwordCredential: {
        create: {
          passwordHash: await argon2.hash(e2eUserPassword),
        },
      },
    },
  });

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@expirymate.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234";
  await prisma.user.create({
    data: {
      email: adminEmail,
      displayName: "장고야 부탁해 Admin",
      accountType: AccountType.registered,
      role: UserRole.admin,
      emailVerifiedAt: new Date(),
      passwordCredential: {
        create: {
          passwordHash: await argon2.hash(adminPassword),
        },
      },
    },
  });

  const products = await Promise.all(
    [
      {
        name: "서울우유 1L",
        brand: "서울우유",
        category: ProductCategory.dairy,
        imageUrl: "https://placehold.co/400x400?text=%EC%84%9C%EC%9A%B8%EC%9A%B0%EC%9C%A0",
      },
      {
        name: "계란 10구",
        brand: "행복란",
        category: ProductCategory.egg,
        imageUrl: "https://placehold.co/400x400?text=%EA%B3%84%EB%9E%80",
      },
      {
        name: "두부",
        brand: "풀무원",
        category: ProductCategory.tofu,
        imageUrl: "https://placehold.co/400x400?text=%EB%91%90%EB%B6%80",
      },
      {
        name: "플레인 요거트",
        brand: "매일",
        category: ProductCategory.dairy,
        imageUrl: "https://placehold.co/400x400?text=%EC%9A%94%EA%B1%B0%ED%8A%B8",
      },
      {
        name: "오렌지 주스",
        brand: "델몬트",
        category: ProductCategory.beverage,
        imageUrl: "https://placehold.co/400x400?text=%EC%98%A4%EB%A0%8C%EC%A7%80+%EC%A3%BC%EC%8A%A4",
      },
      {
        name: "컵라면",
        brand: "농심",
        category: ProductCategory.instant_food,
        imageUrl: "https://placehold.co/400x400?text=%EC%BB%B5%EB%9D%BC%EB%A9%B4",
      },
      {
        name: "샴푸",
        brand: "려",
        category: ProductCategory.personal_care,
        imageUrl: "https://placehold.co/400x400?text=%EC%83%B4%ED%91%B8",
      },
      {
        name: "휴지",
        brand: "크리넥스",
        category: ProductCategory.paper_goods,
        imageUrl: "https://placehold.co/400x400?text=%ED%9C%B4%EC%A7%80",
      },
      {
        name: "세제",
        brand: "피죤",
        category: ProductCategory.cleaning,
        imageUrl: "https://placehold.co/400x400?text=%EC%84%B8%EC%A0%9C",
      },
      {
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

  const productByName = new Map(products.map((product) => [product.name, product]));

  const requireProduct = (name: string) => {
    const product = productByName.get(name);

    if (!product) {
      throw new Error(`Seed product not found for name ${name}`);
    }

    return product;
  };

  await prisma.inventoryItem.createMany({
    data: ["demo-user", e2eUserId].flatMap((ownerKey) => [
      {
        ownerKey,
        productId: requireProduct("서울우유 1L").id,
        displayName: "서울우유 1L",
        brand: "서울우유",
        category: ProductCategory.dairy,
        quantity: 1,
        unit: "팩",
        quantityBase: 1000,
        unitCode: InventoryUnitCode.ml,
        storageLocation: "fridge",
        expiryDate: seedDay(0),
        expirySource: ExpirySource.manual,
        status: ItemStatus.active,
        notes: "아침 시리얼용",
      },
      {
        ownerKey,
        productId: requireProduct("계란 10구").id,
        displayName: "계란 10구",
        brand: "행복란",
        category: ProductCategory.egg,
        quantity: 1,
        unit: "판",
        quantityBase: 10,
        unitCode: InventoryUnitCode.ea,
        storageLocation: "fridge",
        expiryDate: seedDay(3),
        expirySource: ExpirySource.preset,
        status: ItemStatus.active,
        notes: "주말 브런치용",
      },
      {
        ownerKey,
        productId: requireProduct("두부").id,
        displayName: "두부",
        brand: "풀무원",
        category: ProductCategory.tofu,
        quantity: 2,
        unit: "모",
        quantityBase: 2,
        storageLocation: "fridge",
        expiryDate: seedDay(-1),
        expirySource: ExpirySource.manual,
        status: ItemStatus.expired,
        notes: "찌개용",
      },
      {
        ownerKey,
        productId: requireProduct("플레인 요거트").id,
        displayName: "플레인 요거트",
        brand: "매일",
        category: ProductCategory.dairy,
        quantity: 1,
        unit: "통",
        quantityBase: 1,
        storageLocation: "fridge",
        expiryDate: seedDay(7),
        expirySource: ExpirySource.preset,
        status: ItemStatus.active,
        notes: "",
      },
      {
        ownerKey,
        productId: requireProduct("오렌지 주스").id,
        displayName: "오렌지 주스",
        brand: "델몬트",
        category: ProductCategory.beverage,
        quantity: 1,
        unit: "병",
        quantityBase: 1,
        storageLocation: "room",
        expiryDate: seedDay(14),
        expirySource: ExpirySource.manual,
        status: ItemStatus.active,
        notes: "손님용",
      },
      {
        ownerKey,
        productId: requireProduct("컵라면").id,
        displayName: "컵라면",
        brand: "농심",
        category: ProductCategory.instant_food,
        quantity: 4,
        unit: "개",
        quantityBase: 4,
        storageLocation: "kitchen",
        expiryDate: seedDay(30),
        expirySource: ExpirySource.manual,
        status: ItemStatus.active,
        notes: "",
      },
      {
        ownerKey,
        productId: requireProduct("샴푸").id,
        displayName: "샴푸",
        brand: "려",
        category: ProductCategory.personal_care,
        quantity: 1,
        unit: "병",
        quantityBase: 1,
        storageLocation: "bathroom",
        expiryDate: seedDay(90),
        expirySource: ExpirySource.manual,
        status: ItemStatus.active,
        notes: "",
      },
      {
        ownerKey,
        productId: requireProduct("냉동 만두").id,
        displayName: "냉동 만두",
        brand: "비비고",
        category: ProductCategory.frozen_food,
        quantity: 1,
        unit: "봉",
        quantityBase: 1,
        storageLocation: "freezer",
        expiryDate: seedDay(2),
        expirySource: ExpirySource.preset,
        status: ItemStatus.active,
        notes: "야식 후보",
      },
      {
        ownerKey,
        productId: requireProduct("휴지").id,
        displayName: "휴지",
        brand: "크리넥스",
        category: ProductCategory.paper_goods,
        quantity: 12,
        unit: "롤",
        quantityBase: 12,
        storageLocation: "room",
        expiryDate: seedDay(180),
        expirySource: ExpirySource.manual,
        status: ItemStatus.active,
        notes: "재구매 여유 있음",
      },
      {
        ownerKey,
        productId: requireProduct("세제").id,
        displayName: "세제",
        brand: "피죤",
        category: ProductCategory.cleaning,
        quantity: 1,
        unit: "통",
        quantityBase: 0,
        storageLocation: "kitchen",
        expiryDate: seedDay(120),
        expirySource: ExpirySource.manual,
        status: ItemStatus.consumed,
        notes: "리필 구매 예정",
      },
    ]),
  });

  const layoutMilk = await prisma.inventoryItem.findFirstOrThrow({
    where: {
      ownerKey: e2eUserId,
      displayName: "서울우유 1L",
    },
  });

  await prisma.recipeRecommendation.create({
    data: {
      id: "layout-e2e-recommendation",
      ownerKey: e2eUserId,
      request: recipeRecommendationRequestSchema.parse({
        servings: 2,
        maxCookingMinutes: 30,
        mealType: "any",
        useExpiringFirst: true,
      }),
      inventorySnapshot: recipeInventorySnapshotItemSchema.array().parse([
        {
          inventoryItemId: layoutMilk.id,
          name: layoutMilk.displayName,
          category: layoutMilk.category,
          quantity: layoutMilk.quantity,
          unit: layoutMilk.unit,
          quantityBase: layoutMilk.quantityBase,
          unitCode: layoutMilk.unitCode,
          storageLocation: layoutMilk.storageLocation,
          expiryDate: layoutMilk.expiryDate.toISOString().slice(0, 10),
          daysUntilExpiry: 0,
        },
      ]),
      recommendations:
        recipeRecommendationsPayloadSchema.shape.recommendations.parse([
        {
          title: "우유 달걀 프렌치토스트",
          summary: "기한이 가까운 우유를 먼저 쓰는 든든한 한 끼예요.",
          cookingTimeMinutes: 20,
          difficulty: "easy",
          servings: 2,
          usedIngredients: [
            {
              inventoryItemId: layoutMilk.id,
              name: layoutMilk.displayName,
              amount: 300,
              unitCode: "ml",
            },
          ],
          optionalMissingIngredients: [
            { name: "식빵", reason: "우유와 달걀물을 머금어 부드러워져요." },
          ],
          steps: [
            "우유와 달걀을 고르게 섞어 주세요.",
            "식빵을 달걀물에 충분히 적셔 주세요.",
            "팬을 달군 뒤 앞뒤로 노릇하게 익혀 주세요.",
            "속까지 익었는지 확인하고 접시에 담아 주세요.",
          ],
          tips: ["약한 불에서 천천히 익히면 속까지 부드러워요."],
          safetyNote: "우유의 냄새와 상태를 먼저 확인하고 달걀은 완전히 익혀 주세요.",
          spiceLevel: "none",
          requiredEquipment: ["stovetop"],
          mealType: "breakfast",
          strategy: "expiring_first",
        },
        {
          title: "따뜻한 우유 오트밀",
          summary: "추가 재료를 최소화한 간단한 아침 식사예요.",
          cookingTimeMinutes: 10,
          difficulty: "easy",
          servings: 2,
          usedIngredients: [
            {
              inventoryItemId: layoutMilk.id,
              name: layoutMilk.displayName,
              amount: 300,
              unitCode: "ml",
            },
          ],
          optionalMissingIngredients: [],
          steps: ["우유를 냄비에 부어 주세요.", "오트밀을 넣어 주세요.", "약한 불에서 저어가며 끓여 주세요.", "알맞게 걸쭉해지면 불을 꺼 주세요."],
          tips: ["바닥이 눌어붙지 않게 계속 저어 주세요."],
          safetyNote: "우유의 상태를 먼저 확인하고 끓어넘치지 않게 지켜봐 주세요.",
          spiceLevel: "none",
          requiredEquipment: ["stovetop"],
          mealType: "breakfast",
          strategy: "minimal_extra",
        },
        {
          title: "우유 바나나 쉐이크",
          summary: "짧은 시간에 만드는 새로운 간식 조합이에요.",
          cookingTimeMinutes: 5,
          difficulty: "easy",
          servings: 2,
          usedIngredients: [
            {
              inventoryItemId: layoutMilk.id,
              name: layoutMilk.displayName,
              amount: 300,
              unitCode: "ml",
            },
          ],
          optionalMissingIngredients: [
            { name: "바나나", reason: "자연스러운 단맛과 농도를 더해 줘요." },
          ],
          steps: ["우유 상태를 확인해 주세요.", "바나나를 작게 잘라 주세요.", "재료를 믹서에 넣어 주세요.", "부드러워질 때까지 갈아 주세요."],
          tips: ["차가운 우유를 쓰면 더 산뜻해요."],
          safetyNote: "우유의 냄새와 상태를 먼저 확인해 주세요.",
          spiceLevel: "none",
          requiredEquipment: ["microwave"],
          mealType: "snack",
          strategy: "quick_novel",
        },
        ]),
      aiProvider: "seed",
      aiModel: "layout-fixture",
      promptVersion: "layout-e2e-v1",
    },
  });

  await prisma.notificationPreference.createMany({
    data: ["demo-user", e2eUserId].map((ownerKey) => ({
      ownerKey,
      enabled: true,
      reminderDaysBefore: [1, 3, 7],
      remindOnDayOf: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    })),
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

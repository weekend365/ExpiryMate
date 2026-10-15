import React from 'react';
import {ItemStatus, ProductCategory, UnitCode} from '@expirymate/shared';
const noop=()=>{};
const done=async()=>({});
const query=(data:any)=>({data,isSuccess:true,isError:false,isPending:false,isLoading:false,isRefetching:false,error:null,refetch:async()=>({data})});
export const inventory=[
 {id:'demo-tofu',displayName:'두부',quantity:200,quantityBase:200,unit:'g',unitCode:UnitCode.G,category:ProductCategory.TOFU,status:ItemStatus.ACTIVE,storageLocation:'fridge',expiryDate:'2026-10-16'},
 {id:'demo-mushroom',displayName:'버섯',quantity:100,quantityBase:100,unit:'g',unitCode:UnitCode.G,category:ProductCategory.OTHER,status:ItemStatus.ACTIVE,storageLocation:'fridge',expiryDate:'2026-10-17'},
 {id:'demo-egg',displayName:'달걀',quantity:2,quantityBase:2,unit:'개',unitCode:UnitCode.EA,category:ProductCategory.OTHER,status:ItemStatus.ACTIVE,storageLocation:'fridge',expiryDate:'2026-10-20'},
];
export const snapshot=inventory.map((x,i)=>({inventoryItemId:x.id,name:x.displayName,quantity:x.quantity,quantityBase:x.quantityBase,unit:x.unit,unitCode:x.unitCode,storageLocation:x.storageLocation,expiryDate:x.expiryDate,daysUntilExpiry:[1,2,5][i]}));
export const dish={title:'두부버섯볶음',summary:'두부와 버섯을 볶고 달걀을 곁들이는 한 끼예요.',cookingTimeMinutes:20,servings:2,difficulty:'easy',spiceLevel:'none',requiredEquipment:['stovetop'],mealType:'dinner',strategy:'expiring_first',usedIngredients:[{inventoryItemId:'demo-tofu',name:'두부',amount:200,unitCode:UnitCode.G},{inventoryItemId:'demo-mushroom',name:'버섯',amount:100,unitCode:UnitCode.G},{inventoryItemId:'demo-egg',name:'달걀',amount:2,unitCode:UnitCode.EA}],optionalMissingIngredients:[],steps:['두부는 물기를 닦아 먹기 좋은 크기로 썰고 버섯은 손질해요.','달군 팬에 평소 쓰는 식용유를 두르고 두부를 앞뒤로 구워요.','버섯을 넣어 충분히 볶고 평소 쓰는 간장으로 간을 맞춰요.','달걀을 풀어 넣고 완전히 익혀 마무리해요.'],tips:['집에 있는 기본 양념으로 기호에 맞게 간을 맞춰요.'],safetyNote:'재료의 보관 상태를 확인하고 달걀은 충분히 익혀 주세요.'};
export const recommendation={id:'demo-recommendation',createdAt:'2026-10-15T00:00:00.000Z',recommendations:[dish],inventorySnapshot:snapshot,request:{servings:2,maxCookingMinutes:30,mealType:'any',useExpiringFirst:true},engagements:[]};
const history=query([recommendation]), empty=query([]), inv=query(inventory);
const preference=query({allergens:[],excludedIngredients:[],dietaryStyle:'any',maxSpiceLevel:'any',availableEquipment:['stovetop'],updatedAt:'2026-10-15T00:00:00Z'});
const mutation={mutate:noop,mutateAsync:done,isPending:false,error:null,variables:null};
export const useInventoryList=()=>inv;
export const useRecipeRecommendations=()=>history;
export const useRecipeFavorites=()=>empty;
export const useSetRecipeFavorite=()=>mutation;
export const useRecipeEngagement=()=>mutation;
export const getRecipeFavoriteKey=(id:any,n:any)=>`${id}:${n}`;
export const useRecipeGeneration=()=>({status:'idle',latestGeneratedRecommendation:null,latestGeneratedRecommendationId:null,errorMessage:null,errorCode:null,generateRecipeRecommendation:done});
export const useRecipePreferences=()=>({query:preference});
const space={id:'demo-space',name:'우리 집 냉장고',type:'personal',role:'owner'};
export const useActiveSpace=()=>({activeSpace:space,activeSpaceId:space.id,spaces:[space],isLoading:false,error:null,refetchSpaces:done,setActiveSpaceId:noop});
export const useAuth=()=>({sessionUserId:'demo-user',user:{id:'demo-user'}});
export const useSubscriptionEntitlement=()=>({query:query({hasActiveEntitlement:true})});
export const useMonetization=()=>({access:null,adState:'idle',rewardNotice:null,dismissRewardNotice:noop});
export const useRegistrationStore=(select:any)=>select({clearPrefill:noop,setPrefill:noop});
export const useRecommendationGenerateFlow=()=>({showAiNotice:false,closeAiNotice:noop,handleCreateRecommendation:noop,handleAcceptAiNotice:noop,isAcceptingAiNotice:false});
export const consumeRecipePreferenceSavedFromRecommendations=()=>false;
export const recipePreferenceRoute=()=>'/settings/recipe-preferences';
export const useAffiliateOffers=()=>query({enabled:false,offers:[],productGroups:[],trackingMode:'none'});
export const useAffiliateSettings=()=>query({enabled:false});
export const AffiliateEntryImpression=({children}:any)=><>{children}</>;
export const trackAffiliateEntryTap=noop;
export class ApiError extends Error {}
export const trackMonetizationEvent=done;
export const useFocusEffect=(callback:any)=>React.useEffect(callback,[callback]);
export const useLocalSearchParams=()=>({});
export const router={push:noop,replace:noop,back:noop,canGoBack:()=>false};
export const clearRecipePreferenceNavigationState=noop;
export const photoDraftForSpace=()=>null;
export const preferredEntryMethodForSpace=()=>null;

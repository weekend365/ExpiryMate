import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  width: 4000, height: 3000, sizes: [] as number[], files: new Map<string, number>(),
  saved: [] as {width:number;height:number;compress:number}[], deleted: [] as string[],
  resize: vi.fn(), release: vi.fn(), save: vi.fn(), render: vi.fn(), manipulate: vi.fn(),
}));
vi.mock("expo-file-system", () => ({ File: class {
  constructor(private uri:string) {}
  get exists() { return m.files.has(this.uri); }
  get size() { return m.files.get(this.uri) ?? 0; }
  delete() { m.deleted.push(this.uri); m.files.delete(this.uri); }
} }));
vi.mock("expo-image-manipulator", () => ({SaveFormat:{JPEG:"jpeg"},ImageManipulator:{manipulate:m.manipulate}}));
import { prepareInventoryPhoto, withPreparedInventoryPhoto } from "./prepare-inventory-photo";
const original={uri:"file:///original.heic"};
beforeEach(() => {
  vi.clearAllMocks(); m.width=4000; m.height=3000; m.sizes=[1000]; m.files.clear();m.files.set(original.uri,8_000_000);m.saved=[];m.deleted=[];
  let width=m.width, height=m.height;
  m.manipulate.mockImplementation(() => {
    width=m.width;height=m.height;
    return {renderAsync:m.render,resize:m.resize,release:m.release};
  });
  m.resize.mockImplementation((size:{width?:number;height?:number}) => {
    const scale=size.width ? size.width/width : size.height!/height;
    width=Math.round(width*scale);height=Math.round(height*scale);
  });
  m.save.mockImplementation(async ({compress}:{compress:number}) => {
    m.saved.push({width,height,compress});
    const uri=`file:///cache/generated-${m.saved.length}.jpg`;
    m.files.set(uri,m.sizes.shift() ?? 1000);
    return {uri,width,height};
  });
  m.render.mockImplementation(async () => ({width,height,saveAsync:m.save,release:m.release}));
});
it("normalizes through render, preserves ratio and sends a bounded JPEG", async () => {
  const result=await prepareInventoryPhoto(original);
  expect(m.saved).toEqual([{width:2560,height:1920,compress:.9}]);
  expect(m.save).toHaveBeenCalledWith({format:"jpeg",compress:.9});
  expect(result.photo).toMatchObject({mimeType:"image/jpeg",fileName:"inventory-photo.jpg"});
  result.cleanup(); result.cleanup();
  expect(m.deleted).toEqual([result.photo.uri]);
  expect(m.files.has(original.uri)).toBe(true);
});
it.each([[640,480],[480,640],[3000,4000]])("never upscales and respects portrait dimensions %s×%s",async(width,height)=>{
  m.width=width;m.height=height;
  const result=await prepareInventoryPhoto(original);
  expect(m.saved[0]!.width).toBeLessThanOrEqual(width);
  expect(m.saved[0]!.height).toBeLessThanOrEqual(height);
  expect(Math.max(m.saved[0]!.width,m.saved[0]!.height)).toBeLessThanOrEqual(2560);
  expect(m.saved[0]!.width/m.saved[0]!.height).toBeCloseTo(width/height,2);
  result.cleanup();
});
it("tries .9, .8, then 2048/.8 without recompressing an encoded intermediate",async()=>{
  m.sizes=[5_000_000,4_500_000,4*1024*1024];
  const result=await prepareInventoryPhoto(original);
  expect(m.manipulate).toHaveBeenCalledTimes(1);
  expect(m.saved).toEqual([{width:2560,height:1920,compress:.9},{width:2560,height:1920,compress:.8},{width:2048,height:1536,compress:.8}]);
  result.cleanup();expect(m.deleted).toHaveLength(3);
});
it("rejects an oversized file before sending and cleans all generated files",async()=>{
  m.sizes=[5_000_000,5_000_000,5_000_000]; const send=vi.fn();
  await expect(withPreparedInventoryPhoto(original,()=>true,send)).rejects.toThrow("4MB");
  expect(send).not.toHaveBeenCalled();expect(m.deleted).toHaveLength(3);expect(m.files.has(original.uri)).toBe(true);
});
it.each([0,-1])("rejects an unreadable encoded file of size %s",async(size)=>{
  m.sizes=[size];await expect(prepareInventoryPhoto(original)).rejects.toThrow("사진 파일");
  expect(m.deleted).toHaveLength(1);
});
it("rejects corrupt decode without sending or deleting the original",async()=>{
  m.render.mockRejectedValueOnce(new Error("decode failed"));const send=vi.fn();
  await expect(withPreparedInventoryPhoto(original,()=>true,send)).rejects.toThrow("사진 파일");
  expect(send).not.toHaveBeenCalled();expect(m.deleted).toEqual([]);expect(m.release).toHaveBeenCalled();
});
it("does not upload if the account or space changes during preparation",async()=>{
  const current=vi.fn().mockReturnValueOnce(true).mockReturnValue(false),send=vi.fn();
  await expect(withPreparedInventoryPhoto(original,current,send)).rejects.toThrow("계정과 냉장고");
  expect(send).not.toHaveBeenCalled();expect(m.deleted).toHaveLength(1);
});
it("keeps temporary data until multipart completes, then cleans after a failure",async()=>{
  const send=vi.fn(async(photo)=>{expect(m.files.has(photo.uri)).toBe(true);throw new Error("network");});
  await expect(withPreparedInventoryPhoto(original,()=>true,send)).rejects.toThrow("network");
  expect(m.deleted).toHaveLength(1);expect(send).toHaveBeenCalledTimes(1);
});
it("skips all preparation for a stale context",async()=>{
  await expect(withPreparedInventoryPhoto(original,()=>false,vi.fn())).rejects.toThrow("계정과 냉장고");
  expect(m.manipulate).not.toHaveBeenCalled();
});
it("localizes a synchronous decoder failure and never touches the original", async () => {
  m.manipulate.mockImplementationOnce(() => { throw new Error("missing decoder"); });
  await expect(prepareInventoryPhoto(original)).rejects.toThrow("사진 파일");
  expect(m.deleted).toEqual([]);
});
it.each([0, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid decoded dimensions %s", async (width) => {
  m.width=width;
  await expect(prepareInventoryPhoto(original)).rejects.toThrow("사진 파일");
  expect(m.save).not.toHaveBeenCalled();
});

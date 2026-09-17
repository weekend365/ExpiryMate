from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
pairs = json.loads((root / 'sample-pairs.json').read_text())
results = []
def ssim_blocks(a, b):
    h, w = a.shape
    h, w = h // 8 * 8, w // 8 * 8
    a = a[:h,:w].reshape(h//8,8,w//8,8).transpose(0,2,1,3).reshape(-1,64)
    b = b[:h,:w].reshape(h//8,8,w//8,8).transpose(0,2,1,3).reshape(-1,64)
    ma, mb = a.mean(1), b.mean(1)
    da, db = a - ma[:,None], b - mb[:,None]
    va, vb, cov = (da*da).mean(1), (db*db).mean(1), (da*db).mean(1)
    return float((((2*ma*mb+6.5025)*(2*cov+58.5225))/((ma*ma+mb*mb+6.5025)*(va+vb+58.5225))).mean())

for pair in pairs:
    a = np.asarray(Image.open(pair['reference']).convert('RGB'), dtype=np.float32)[160:2100,20:1186]
    b = np.asarray(Image.open(pair['encoded']).convert('RGB'), dtype=np.float32)[160:2100,20:1186]
    assert a.shape == b.shape
    mse = float(((a-b)**2).mean())
    weights = np.array([.2126,.7152,.0722],dtype=np.float32)
    ya, yb = a @ weights, b @ weights
    gx = np.zeros_like(ya); gy = np.zeros_like(ya)
    gx[:,1:-1] = (ya[:,2:] - ya[:,:-2]) / 2
    gy[1:-1,:] = (ya[2:,:] - ya[:-2,:]) / 2
    edges = gx*gx + gy*gy > 12*12
    edge_mse = float(((a-b)[edges]**2).mean())
    row = {'frame':pair['frame'],'time':pair['time'],'psnr_rgb_db':10*math.log10(255**2/mse),'ssim_8x8_luma':ssim_blocks(ya,yb),'mean_absolute_rgb_error':float(np.abs(a-b).mean()),'text_edge_psnr_db':10*math.log10(255**2/edge_mse),'text_edge_absolute_luma_error':float(np.abs(ya-yb)[edges].mean()),'mean_luma_shift':float((yb-ya).mean()),'decoded_time_error_seconds':abs(pair['time']-pair['decoded_time'])}
    results.append(row)

summary = {'method':'Final decoded video compared with lossless frames rendered directly from the original recording, with the same HDR-to-SDR conversion, exposure and subtitles. App region x=20..1186, y=160..2100 excludes subtitle overlay. This measures the export/decode path, not the independent HDR-to-SDR or 60-to-30 fps changes.', 'ssim_definition':'Mean 8x8 non-overlapping population-variance SSIM on Rec.709 luma; C1=6.5025 and C2=58.5225. Not a perceptual quality percentage.', 'sample_count':len(results), 'metrics':{}, 'samples':results}
for key in ['psnr_rgb_db','ssim_8x8_luma','mean_absolute_rgb_error','text_edge_psnr_db','text_edge_absolute_luma_error','mean_luma_shift','decoded_time_error_seconds']:
    values=[row[key] for row in results]
    summary['metrics'][key]={'mean':float(np.mean(values)),'min':min(values),'max':max(values)}
(root/'quality-metrics.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))

# Native-pixel detail crops make text-edge changes inspectable without resizing.
chosen = next(x for x in pairs if x['frame'] == 630)
box=(55,880,1151,1250)
left=Image.open(chosen['reference']).convert('RGB').crop(box)
right=Image.open(chosen['encoded']).convert('RGB').crop(box)
canvas=Image.new('RGB',(2264,570),'#faf9f5')
d=ImageDraw.Draw(canvas)
fonts=Path('/Users/namu/Desktop/ExpiryMate/apps/mobile/assets/fonts')
title=ImageFont.truetype(str(fonts/'Pretendard-Bold.otf'),30)
small=ImageFont.truetype(str(fonts/'Pretendard-Regular.otf'),23)
d.text((24,20),'원본에서 렌더한 무압축 프레임',font=title,fill='#20252a')
d.text((1144,20),'최종 나레이션 영상',font=title,fill='#20252a')
d.text((24,65),'동일한 색 변환 적용 · 저장 직전',font=small,fill='#58605c')
d.text((1144,65),'H.264 저장 후 디코딩 · 21초 장면',font=small,fill='#58605c')
canvas.paste(left,(24,115)); canvas.paste(right,(1144,115))
d.text((24,510),'글자 부분을 원본 픽셀 크기로 비교했습니다. HDR 색 변화와 프레임 수 차이는 별도 항목입니다.',font=small,fill='#58605c')
canvas.save(root/'text-detail-comparison.png')
print(json.dumps({'sample_count':len(results),'metrics':summary['metrics']},ensure_ascii=False,indent=2))

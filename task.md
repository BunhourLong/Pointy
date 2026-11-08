# Task: local sketch-to-image on Windows (RTX 5060 8GB)

Goal: run SD 1.5 + LCM-LoRA + ControlNet scribble locally and turn a stroke image into a picture.
Run every command in **PowerShell** on the Windows PC with the GPU.

## 0. Prerequisites
- NVIDIA driver **570 or newer** (Blackwell needs it). Check: `nvidia-smi`
- Python **3.11 or 3.12** (64-bit). Check: `python --version`
- ~10 GB free disk (venv ~5 GB, models ~4 GB)

## 1. Create the environment
```powershell
mkdir pointy-sd; cd pointy-sd
python -m venv sd
# If activation is blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\sd\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

## 2. Install packages
```powershell
pip install torch --index-url https://download.pytorch.org/whl/cu128
pip install diffusers transformers accelerate peft
```
The `cu128` build is required for the 5060.

## 3. Verify the GPU is visible
```powershell
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```
Expected: `True NVIDIA GeForce RTX 5060`. If `False`, stop: update the driver or reinstall torch with the `cu128` index.

## 4. Create `gen.py`
```python
import torch
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel, LCMScheduler
from diffusers.utils import load_image

cn = ControlNetModel.from_pretrained(
    "lllyasviel/control_v11p_sd15_scribble", torch_dtype=torch.float16, variant="fp16")
pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "stable-diffusion-v1-5/stable-diffusion-v1-5",
    controlnet=cn, torch_dtype=torch.float16, variant="fp16").to("cuda")
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
pipe.load_lora_weights("latent-consistency/lcm-lora-sdv1-5")

img = pipe("a red house, watercolor", image=load_image("strokes.png"),
           num_inference_steps=5, guidance_scale=1.5).images[0]
img.save("out.png")
```

## 5. Provide `strokes.png`
- ~512x512, **white lines on a black background** (what the scribble ControlNet expects).
- Export from Pointy and invert if needed, or draw any test scribble.

## 6. Run
```powershell
python gen.py
```
- First run downloads ~3-4 GB from Hugging Face (cached afterwards, in `%USERPROFILE%\.cache\huggingface`).
- Output: `out.png`.

## Done when
- `out.png` exists and its structure follows the strokes.
- Second run (cached) takes seconds, not minutes.

## Troubleshooting
- `CUDA out of memory`: close other GPU apps (browser hardware accel, games); add `pipe.enable_model_cpu_offload()` instead of `.to("cuda")`.
- Black or noisy image: lower `guidance_scale` to 1.0-1.5; LCM breaks above ~2.
- Image ignores strokes: check the white-on-black rule.
- Slow download or 401: repos are public, no login needed; retry or check the network.
- Repo name not found: Hugging Face names can change; search the model name on huggingface.co.

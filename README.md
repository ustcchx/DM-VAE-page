# Dual-Manifold Variational Autoencoders (DM-VAE)

Official project page & repository for **Dual-Manifold Variational Autoencoders**.

- **Project Page:** [https://ustcchx.github.io/DM-VAE/](https://ustcchx.github.io/DM-VAE/)
- **Authors:** Hongxu Chen*, Chun Wang*, Yanghao Wang, Hongxiang Li, Zhen Wang, Zhixiang Zhang, Long Chen† (HKUST)

## Highlights
- **Foundation-Model-Free SOTA Reconstruction:** `0.12 rFID` (`30.76 dB PSNR`) on ImageNet-1K 256×256 (`f16d64`) and `1.12 rFID` (`32.87 dB PSNR`) zero-shot OOD reconstruction on Anime-Faces-256 without relying on frozen external priors (e.g., DINOv2).
- **Overcoming the Off-Manifold Dilemma:** `1.25 / 1.28 FID_50K` (w/o CFG, single-pass `IG_TS`) and `1.17 / 1.20 FID_50K` (w/ CFG) under `f16d32 / f16d64` without external foundation models; `1.11 FID_50K` when orthogonally combined with DINOv2.

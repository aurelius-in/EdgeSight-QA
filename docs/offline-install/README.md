# Offline Install

1. Mirror images:
   ```bash
   bash security/scripts/offline_mirror.sh security/sbom/mirror.txt _bundle/images
   ```
2. Transfer `_bundle/` to target and load images with `docker load -i *.tar` or import to a local registry.
3. Verify checksums for SBOMs and images.
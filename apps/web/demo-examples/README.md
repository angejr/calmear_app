# Demo examples ("Try an example")

Pre-processed clips for the landing-page demo. The "Try an example" button
stays hidden until `public/demo/examples/manifest.json` lists at least one
example.

## Adding examples

1. Put the source recordings in `demo-examples/src/`. This folder is
   git-ignored, so the originals are not committed. Only use recordings
   CalmEar has the right to publish, such as recordings made by the team.
   Do not use YouTube or other third-party footage.
2. Create `demo-examples/examples.json`:

   ```json
   {
     "examples": [
       {
         "id": "chewing",
         "title": "Chewing",
         "description": "Someone eating crisps close to the microphone.",
         "source": "src/chewing.mp4",
         "start": 0,
         "duration": 12
       }
     ]
   }
   ```

   `start` and `duration` are optional and in seconds. An example can be at
   most 15 seconds long.
3. Run `npm run demo:examples`. This needs ffmpeg on your PATH and the
   extension model: by default `../../../calmear_extension/extension/model/model.onnx`,
   or pass `--model <path>`.
4. Listen to the results, then commit `public/demo/examples/` (the manifest
   plus `original.m4a` and `processed.m4a` for each example).

The script runs the same pipeline as the upload demo: the extension's model,
threshold, merging and ERSM suppression. Both versions of a clip are encoded
with the same AAC settings, so the comparison is fair.

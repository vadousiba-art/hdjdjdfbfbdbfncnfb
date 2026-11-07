// Registers the Brand Lab samples as BrandLab01..BrandLab20 (1080x1920, 30 fps).
import React from "react";
import { CalculateMetadataFunction, Composition, continueRender, delayRender, Folder, staticFile } from "remotion";
import { loadBrandFonts } from "../shared/theme";
import { LabProps, SAMPLES } from "./samples";

const fonts = delayRender("brand fonts");
loadBrandFonts().then(() => continueRender(fonts));

const withWords = (take?: string): CalculateMetadataFunction<LabProps> => async () => {
  if (!take) return { props: { words: [] } };
  const res = await fetch(staticFile(`recordings/${take}.words.json`));
  return { props: { words: await res.json() } };
};

export const BrandLab: React.FC = () => (
  <Folder name="BrandLab">
    {SAMPLES.map((s) => (
      <Composition
        key={s.id}
        id={`BrandLab${s.id}`}
        component={s.C}
        durationInFrames={s.frames}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ words: [] }}
        calculateMetadata={withWords(s.take)}
      />
    ))}
  </Folder>
);

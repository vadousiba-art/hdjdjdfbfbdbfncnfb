import { BrandLab } from "./brand-lab/Lab";
import { MyComposition } from "./Composition";
import { Goal1 } from "./goal1/Goal";
import { Goal2 } from "./goal2/Goal2";
import { Motivation } from "./motivation/Motivation";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <BrandLab />
      <Goal1 />
      <Goal2 />
      <Motivation />
    </>
  );
};

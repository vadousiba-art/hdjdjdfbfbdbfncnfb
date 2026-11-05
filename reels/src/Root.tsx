import { BrandLab } from "./brand-lab/Lab";
import { MyComposition } from "./Composition";
import { Goal1 } from "./goal1/Goal";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <BrandLab />
      <Goal1 />
    </>
  );
};

import { RectShape } from "@/redux/slice/shapes";

export const Rectangle = ({ shape }: { shape: RectShape }) => (
  <div
    className="absolute border-solid pointer-events-none"
    style={{
      left: shape.x,
      top: shape.y,
      width: shape.w,
      height: shape.h,
      borderColor: shape.stroke,
      borderWidth: shape.strokeWidth,
      backgroundColor: shape.fill ?? "transparent",
      borderRadius: "8px", // Add rounded corners
    }}
  />
);

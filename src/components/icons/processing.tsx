import { IconProps } from "./types";

export const IconProcessing = (props: IconProps) => {
  const {
    className,
    style,
  } = props;

  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path
        d="M4.5 8.5C6.70914 8.5 8.5 6.70914 8.5 4.5C8.5 2.29086 6.70914 0.5 4.5 0.5C2.29086 0.5 0.5 2.29086 0.5 4.5"
        stroke="currentColor"
        stroke-linecap="round"
      />
    </svg>
  );
};

export default IconProcessing;

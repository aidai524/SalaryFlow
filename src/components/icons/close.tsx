import { IconProps } from "./types";

export const IconClose = (props: IconProps) => {
  const {
    className,
    style,
  } = props;

  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <line
        x1="0.75"
        y1="-0.75"
        x2="16.2197"
        y2="-0.75"
        transform="matrix(0.707069 -0.707145 0.707069 0.707145 1.00122 12.75)"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <line
        x1="0.75"
        y1="-0.75"
        x2="16.2197"
        y2="-0.75"
        transform="matrix(-0.707069 -0.707145 -0.707069 0.707145 11.9985 12.75)"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};

export default IconClose;

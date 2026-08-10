import { IconProps } from "./types";

export const IconPay = (props: IconProps) => {
  const {
    className,
    style,
  } = props;

  return (
    <svg
      width="12"
      height="13"
      viewBox="0 0 12 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path
        d="M5.6001 8.59998V0.599976M9.1001 4.09998L5.6001 0.599976L2.1001 4.09998M0.600098 7.59998V11.6H11.1001V7.59998"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default IconPay;

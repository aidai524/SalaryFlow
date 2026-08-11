import { IconProps } from "./types";

export const IconWallet = (props: IconProps) => {
  const {
    className,
    style,
  } = props;

  return (
    <svg
      width="14"
      height="11"
      viewBox="0 0 14 11"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path
        d="M13.1765 7.85714V11H0V0H13.1765V3.14286H14V7.85714H13.1765ZM12.3529 4.71429H10.7059C10.2118 4.71429 9.88235 5.02857 9.88235 5.5C9.88235 5.97143 10.2118 6.28571 10.7059 6.28571H12.3529V4.71429ZM11.5294 3.14286V1.57143H1.64706V9.42857H11.5294V7.85714H10.7059C9.30588 7.85714 8.23529 6.83571 8.23529 5.5C8.23529 4.16429 9.30588 3.14286 10.7059 3.14286H11.5294Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default IconWallet;

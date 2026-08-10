import { IconProps } from "./types";

export const IconLoading = (props: IconProps) => {
  const {
    className,
    style,
  } = props;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      className={className}
      style={style}
    >
      <path
        d="M10.9474 6.5C10.9474 4.04379 8.95621 2.05263 6.5 2.05263C4.04379 2.05263 2.05263 4.04379 2.05263 6.5C2.05263 7.06682 1.59313 7.52632 1.02632 7.52632C0.459497 7.52632 0 7.06682 0 6.5C0 2.91015 2.91015 0 6.5 0C10.0899 0 13 2.91015 13 6.5C13 10.0899 10.0899 13 6.5 13C5.93318 13 5.47368 12.5405 5.47368 11.9737C5.47368 11.4069 5.93318 10.9474 6.5 10.9474C8.95621 10.9474 10.9474 8.95621 10.9474 6.5Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default IconLoading;

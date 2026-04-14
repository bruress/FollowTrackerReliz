import { LogoSvgDr } from "../constant/Svg"
import Text from "./Text";

const Logo = () => {
    return (
        <div className="flex items-center gap-[20px]">
            <LogoSvgDr/>
            <a>
                <Text
                    text="FollowTracker"
                    type="subtitle_dr"
                />
            </a>
        </div>
    );
};

export default Logo;
{/* main */}
const Text = ({text, type, classes}) => {

    {/* base styles for text */}
    const baseStyles = {
        title_dr: "font-raleway text-[32px] font-bold text-[#040C22] sm:text-[48px] lg:text-[64px]",
        title_wh: "font-raleway text-[32px] font-bold text-[#ffffff] text-center xl:text-start lg:text-[48px] sm:text-[42px] md:text-[48px] xl:text-[52px] 2xl:text-[64px]",
        subtitle_wh: "text-[#ffffff] sm:text-[24px] text-[14px] font-raleway ",
        subtitle_dr: "text-[#040C22] sm:text-[24px] text-[14px] font-raleway text-center pb-[8px]" ,
        subtitle_gr: "text-[#58627F] sm:text-[24px] text-[14px] font-raleway text-center",
        subtitle_cd: "text-[24px] font-raleway font-bold text-center",
        paragraph: "text[20px] font-inter",
        paragraph_wh: "lg:text-[20px] sm:text-[14px] font-inter text-[12px] text-[#ffffff]",
        paragraph_dr: "lg:text-[20px] sm:text-[14px] font-inter text-[12px] text-[#040C22]",
        paragraph_cd: "text[16px] font-inter pt-[20px] text-center",
        error: "p-[5px] lg:text-[16px] sm:text-[12px] font-inter text-[10px] text-[#800B12]"
    };

    {/* combinating styles with style classes */}
    const finalStyle = `${baseStyles[type]} ${classes}`;
    
    return (
        <p className={finalStyle}>{text}</p>
    );
};

export default Text;

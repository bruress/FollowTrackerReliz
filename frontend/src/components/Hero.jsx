

const Hero = ({user}) => {
    return (
        <div>
            {user ? (
                <div className="text-9xl">
                    Успешно, {user.username}!
                </div>
            ) : 
            (
                <div>Неуспешно</div>
            )

            }
        </div>
    )
}

export default Hero;
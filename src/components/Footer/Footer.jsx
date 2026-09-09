import Style from './Footer.module.css'
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTiktok, faInstagram, faFacebookF, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { faLaptopCode } from "@fortawesome/free-solid-svg-icons";

function Footer () {
  return (
    <footer className={Style.footer}>
            <h3>¡Síguenos en nuestras redes sociales!</h3>
            <div className={Style['social-links']}>
                <a 
                    href="https://www.instagram.com/ikigaidojo.ka.ko/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title="Instagram">
                    <FontAwesomeIcon icon={faInstagram} />
                </a>
                <a 
                    href="https://www.facebook.com/profile.php?id=61561605354382" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title="Facebook">
                    <FontAwesomeIcon icon={faFacebookF} />
                </a>
                <a 
                    href="https://www.tiktok.com/@ikigaidojo.ka.ko?is_from_webapp=1&sender_device=pc" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title="TikTok">
                    <FontAwesomeIcon icon={faTiktok} />
                </a>
                <a 
                    href="https://youtube.com/@ikigaidojo-ka-ko?si=EB4X8dxEKwLlcdgb" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title="YouTube">
                    <FontAwesomeIcon icon={faYoutube} />
                </a>
            </div>
            <div className={Style.container}>
                <p>&copy; 2026 IKIGAI DOJO. Todos los derechos reservados.</p>
                <p>Hecho con <FontAwesomeIcon icon={faLaptopCode} /> y pasión marcial.</p>
            </div>
        </footer>   
  )
}

export default Footer
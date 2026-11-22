use base64::{Engine, engine::general_purpose::STANDARD};
use image::{Frame, Rgba, RgbaImage, codecs::gif::GifEncoder};

use super::encode_preview;

#[test]
fn serves_gif_cover_with_its_original_animation() {
    let mut gif = Vec::new();
    {
        let mut encoder = GifEncoder::new(&mut gif);
        let red = RgbaImage::from_pixel(720, 1, Rgba([255, 0, 0, 255]));
        let blue = RgbaImage::from_pixel(720, 1, Rgba([0, 0, 255, 255]));
        encoder
            .encode_frames([Frame::new(red), Frame::new(blue)])
            .unwrap();
    }

    let url = encode_preview(gif.clone()).unwrap().unwrap();
    let payload = url.strip_prefix("data:image/gif;base64,").unwrap();

    assert_eq!(STANDARD.decode(payload).unwrap(), gif);
}

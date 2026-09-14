const stage = document.getElementById("coffee-3d");
const heroProduct = document.getElementById("heroProduct");
const backPhoto = document.querySelector(".back-photo");
const badgeOne = document.querySelector(".badge-one");
const badgeTwo = document.querySelector(".badge-two");

if (stage && heroProduct) {
  let frame;
  let pointerX = 0;
  let pointerY = 0;

  function moveProduct() {
    const rotateY = pointerX * 10;
    const rotateX = pointerY * -8;

    heroProduct.style.transform = `
      rotate(-7deg)
      rotateY(${rotateY - 9}deg)
      rotateX(${rotateX}deg)
      translate3d(${pointerX * 14}px, ${pointerY * 10}px, 45px)
    `;

    if (backPhoto) {
      backPhoto.style.transform = `
        rotate(11deg)
        translate3d(${pointerX * -20}px, ${pointerY * -12}px, -90px)
      `;
    }

    if (badgeOne) {
      badgeOne.style.transform = `
        rotate(-8deg)
        translate3d(${pointerX * -12}px, ${pointerY * -9}px, 65px)
      `;
    }

    if (badgeTwo) {
      badgeTwo.style.transform = `
        rotate(8deg)
        translate3d(${pointerX * 12}px, ${pointerY * 10}px, 60px)
      `;
    }

    frame = null;
  }

  stage.addEventListener("pointermove", (event) => {
    const rect = stage.getBoundingClientRect();

    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    if (!frame) frame = requestAnimationFrame(moveProduct);
  });

  stage.addEventListener("pointerleave", () => {
    pointerX = 0;
    pointerY = 0;

    heroProduct.style.transform = "rotate(-7deg) rotateY(-9deg)";
    if (backPhoto) backPhoto.style.transform = "rotate(11deg) translateZ(-90px)";
    if (badgeOne) badgeOne.style.transform = "rotate(-8deg)";
    if (badgeTwo) badgeTwo.style.transform = "rotate(8deg)";
  });
}
<?php

namespace App\Entity;

use App\Repository\PropertyRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: PropertyRepository::class)]
#[ORM\UniqueConstraint(name: 'uniq_property_guest_lucky', columns: ['guest_lucky_id'])]
class Property
{
    #[ORM\Column(nullable: true)]
    private ?int $guestLuckyId = null;

    #[ORM\Column(options: ['default' => false])]
    private bool $active = false;

    #[ORM\Column(nullable: true)]
    private ?int $minimumStay = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $address = null;

    #[ORM\Column(nullable: true)]
    private ?float $latitude = null;

    #[ORM\Column(nullable: true)]
    private ?float $longitude = null;

    public function getAddress(): ?string { return $this->address; }
    public function getLatitude(): ?float { return $this->latitude; }
    public function getLongitude(): ?float { return $this->longitude; }
    public function setAddress(?string $address): self
    {
        $address = $address !== null ? trim($address) : null;
        $normalize = static fn (?string $value): string => trim(preg_replace('/[,\s]+/u', ' ', preg_replace('/[,\s]+france$/iu', '', mb_strtolower(str_replace('’', "'", $value ?? '')))));
        if ($normalize($address) !== $normalize($this->address)) $this->latitude = $this->longitude = null;
        $this->address = $address ?: null;
        return $this;
    }
    public function setCoordinates(?float $latitude, ?float $longitude): self
    {
        if (($latitude === null) !== ($longitude === null) || ($latitude !== null && (!is_finite($latitude) || !is_finite($longitude) || abs($latitude) > 90 || abs($longitude) > 180))) {
            throw new \InvalidArgumentException('Invalid property coordinates.');
        }
        $this->latitude = $latitude; $this->longitude = $longitude;
        return $this;
    }
    public function getDirectionsUrl(): ?string
    {
        return $this->address ? 'https://www.google.com/maps/dir/?'.http_build_query(['api' => 1, 'destination' => $this->address], '', '&', PHP_QUERY_RFC3986) : null;
    }

    public function getMinimumStay(): ?int { return $this->minimumStay; }
    public function setMinimumStay(?int $nights): self
    {
        if ($nights !== null && $nights < 1) { throw new \InvalidArgumentException('Minimum stay must be positive.'); }
        $this->minimumStay = $nights;
        return $this;
    }

    public function getGuestLuckyId(): ?int { return $this->guestLuckyId; }
    public function setGuestLuckyId(?int $id): self { $this->guestLuckyId = $id; return $this; }
    public function isActive(): bool { return $this->active; }
    public function setActive(bool $active): self { $this->active = $active; return $this; }

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    private ?string $title = null;

    #[ORM\Column(length: 180, unique: true)]
    private ?string $slug = null;

    #[ORM\Column(length: 50, nullable: true)]
    private ?string $type = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $shortDescription = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $about = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $accommodation = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $guestAccess = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $otherRemarks = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $shortDescriptionEn = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $aboutEn = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $accommodationEn = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $guestAccessEn = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $otherRemarksEn = null;

    #[ORM\Column(type: 'integer')]
    private int $travelers = 1;

    // The provider can accept fewer guests than the property's public listing.
    #[ORM\Column(nullable: true)]
    private ?int $providerCapacity = null;

    #[ORM\Column(type: 'integer')]
    private int $bedrooms = 0;

    #[ORM\Column(type: 'integer')]
    private int $beds = 0;

    #[ORM\Column(type: 'float')]
    private float $bathrooms = 0.0;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $area = null;

    #[ORM\Column(length: 120)]
    private ?string $city = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $airbnbUrl = null;

    #[ORM\Column(type: 'float', nullable: true)]
    private ?float $airbnbRating = null;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $airbnbReviewsCount = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    #[ORM\ManyToMany(targetEntity: Amenity::class, inversedBy: 'properties')]
    #[ORM\JoinTable(name: 'property_amenity')]
    private Collection $amenities;

    #[ORM\OneToMany(mappedBy: 'property', targetEntity: PropertyImage::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $images;

    #[ORM\OneToMany(mappedBy: 'property', targetEntity: Review::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $reviews;

    public function __construct()
    {
        $this->amenities = new ArrayCollection();
        $this->images = new ArrayCollection();
        $this->reviews = new ArrayCollection();
        $now = new \DateTimeImmutable();
        $this->createdAt = $now;
        $this->updatedAt = $now;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitle(): ?string
    {
        return $this->title;
    }

    public function setTitle(string $title): self
    {
        $this->title = $title;

        return $this;
    }

    public function getSlug(): ?string
    {
        return $this->slug;
    }

    public function setSlug(string $slug): self
    {
        $this->slug = $slug;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): self
    {
        $this->description = $description;

        return $this;
    }

    public function getAbout(): ?string
    {
        return $this->about;
    }

    public function setAbout(?string $about): self
    {
        $this->about = $about;

        return $this;
    }

    public function getAccommodation(): ?string
    {
        return $this->accommodation;
    }

    public function setAccommodation(?string $accommodation): self
    {
        $this->accommodation = $accommodation;

        return $this;
    }

    public function getGuestAccess(): ?string
    {
        return $this->guestAccess;
    }

    public function setGuestAccess(?string $guestAccess): self
    {
        $this->guestAccess = $guestAccess;

        return $this;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(?string $type): self
    {
        $this->type = $type;

        return $this;
    }

    public function getShortDescription(): ?string
    {
        return $this->shortDescription;
    }

    public function setShortDescription(?string $shortDescription): self
    {
        $this->shortDescription = $shortDescription;

        return $this;
    }

    public function getOtherRemarks(): ?string
    {
        return $this->otherRemarks;
    }

    public function setOtherRemarks(?string $otherRemarks): self
    {
        $this->otherRemarks = $otherRemarks;

        return $this;
    }

    public function getShortDescriptionEn(): ?string
    {
        return $this->shortDescriptionEn;
    }

    public function setShortDescriptionEn(?string $shortDescriptionEn): self
    {
        $this->shortDescriptionEn = $shortDescriptionEn;

        return $this;
    }

    public function getAboutEn(): ?string
    {
        return $this->aboutEn;
    }

    public function setAboutEn(?string $aboutEn): self
    {
        $this->aboutEn = $aboutEn;

        return $this;
    }

    public function getAccommodationEn(): ?string
    {
        return $this->accommodationEn;
    }

    public function setAccommodationEn(?string $accommodationEn): self
    {
        $this->accommodationEn = $accommodationEn;

        return $this;
    }

    public function getGuestAccessEn(): ?string
    {
        return $this->guestAccessEn;
    }

    public function setGuestAccessEn(?string $guestAccessEn): self
    {
        $this->guestAccessEn = $guestAccessEn;

        return $this;
    }

    public function getOtherRemarksEn(): ?string
    {
        return $this->otherRemarksEn;
    }

    public function setOtherRemarksEn(?string $otherRemarksEn): self
    {
        $this->otherRemarksEn = $otherRemarksEn;

        return $this;
    }

    public function getTravelers(): int
    {
        return $this->travelers;
    }

    public function setTravelers(int $travelers): self
    {
        $this->travelers = $travelers;

        return $this;
    }

    public function getProviderCapacity(): ?int { return $this->providerCapacity; }

    public function setProviderCapacity(?int $capacity): self
    {
        if ($capacity !== null && $capacity < 1) { throw new \InvalidArgumentException('Provider capacity must be positive.'); }
        $this->providerCapacity = $capacity;
        return $this;
    }

    public function getBookingCapacity(): int
    {
        return min($this->travelers, $this->providerCapacity ?? $this->travelers);
    }

    public function getBedrooms(): int
    {
        return $this->bedrooms;
    }

    public function setBedrooms(int $bedrooms): self
    {
        $this->bedrooms = $bedrooms;

        return $this;
    }

    public function getBeds(): int
    {
        return $this->beds;
    }

    public function setBeds(int $beds): self
    {
        $this->beds = $beds;

        return $this;
    }

    public function getBathrooms(): float
    {
        return $this->bathrooms;
    }

    public function setBathrooms(float $bathrooms): self
    {
        $this->bathrooms = $bathrooms;

        return $this;
    }

    public function getArea(): ?int
    {
        return $this->area;
    }

    public function setArea(?int $area): self
    {
        $this->area = $area;

        return $this;
    }

    public function getCity(): ?string
    {
        return $this->city;
    }

    public function setCity(string $city): self
    {
        $this->city = $city;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeImmutable $createdAt): self
    {
        $this->createdAt = $createdAt;

        return $this;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(\DateTimeImmutable $updatedAt): self
    {
        $this->updatedAt = $updatedAt;

        return $this;
    }

    /**
     * @return Collection<int, Amenity>
     */
    public function getAmenities(): Collection
    {
        return $this->amenities;
    }

    public function addAmenity(Amenity $amenity): self
    {
        if (!$this->amenities->contains($amenity)) {
            $this->amenities->add($amenity);
            $amenity->addProperty($this);
        }

        return $this;
    }

    public function removeAmenity(Amenity $amenity): self
    {
        if ($this->amenities->removeElement($amenity)) {
            $amenity->removeProperty($this);
        }

        return $this;
    }

    /**
     * @return Collection<int, PropertyImage>
     */
    public function getImages(): Collection
    {
        return $this->images;
    }

    public function addImage(PropertyImage $image): self
    {
        if (!$this->images->contains($image)) {
            $this->images->add($image);
            $image->setProperty($this);
        }

        return $this;
    }

    public function removeImage(PropertyImage $image): self
    {
        if ($this->images->removeElement($image)) {
            if ($image->getProperty() === $this) {
                $image->setProperty(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Review>
     */
    public function getReviews(): Collection
    {
        return $this->reviews;
    }

    public function addReview(Review $review): self
    {
        if (!$this->reviews->contains($review)) {
            $this->reviews->add($review);
            $review->setProperty($this);
        }

        return $this;
    }

    public function removeReview(Review $review): self
    {
        if ($this->reviews->removeElement($review)) {
            if ($review->getProperty() === $this) {
                $review->setProperty(null);
            }
        }

        return $this;
    }

    public function getAirbnbUrl(): ?string
    {
        return $this->airbnbUrl;
    }

    public function setAirbnbUrl(?string $airbnbUrl): self
    {
        $this->airbnbUrl = $airbnbUrl;

        return $this;
    }

    public function getAirbnbRating(): ?float
    {
        return $this->airbnbRating;
    }

    public function setAirbnbRating(?float $airbnbRating): self
    {
        $this->airbnbRating = $airbnbRating;

        return $this;
    }

    public function getAirbnbReviewsCount(): ?int
    {
        return $this->airbnbReviewsCount;
    }

    public function setAirbnbReviewsCount(?int $airbnbReviewsCount): self
    {
        $this->airbnbReviewsCount = $airbnbReviewsCount;

        return $this;
    }
}

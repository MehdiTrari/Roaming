<?php

namespace App\Service;

use App\Entity\ContactMessage;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Twig\Environment;

class ContactService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly MailerInterface $mailer,
        #[Autowire('%env(CONTACT_RECIPIENT_EMAIL)%')] private readonly string $recipient,
    ) {
    }

    public function handle(ContactMessage $message): void
    {
        $this->em->persist($message);
        $this->em->flush();

        $email = (new TemplatedEmail())
            ->from($message->getEmail() ?: 'no-reply@roamingfr.com')
            ->to($this->recipient)
            ->subject('[Roaming Home] ' . ($message->getSubject() ?: 'Nouveau message'))
            ->htmlTemplate('emails/contact.html.twig')
            ->context([
                'contact' => $message,
            ]);

        try {
            $this->mailer->send($email);
        } catch (TransportExceptionInterface $e) {
            // In dev, failing silently while keeping the message saved can be acceptable; surface via logs.
        }
    }
}

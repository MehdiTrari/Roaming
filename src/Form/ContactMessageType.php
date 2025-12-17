<?php

namespace App\Form;

use App\Entity\ContactMessage;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Form\Extension\Core\Type\TelType;
use Symfony\Component\Validator\Constraints\Email;
use Symfony\Component\Validator\Constraints\Length;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\Regex;

class ContactMessageType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('name', TextType::class, [
                'label' => 'Name',
                'constraints' => [new NotBlank(message: 'Veuillez renseigner votre nom.'), new Length(max: 150)],
                'attr' => ['placeholder' => 'Your name'],
            ])
            ->add('email', EmailType::class, [
                'label' => 'Email',
                'constraints' => [new NotBlank(message: 'Veuillez renseigner votre email.'), new Email(message: 'Veuillez entrer un email valide.'), new Length(max: 180)],
                'attr' => ['placeholder' => 'you@example.com'],
            ])
            ->add('phone', TelType::class, [
                'label' => 'Phone',
                'required' => false,
                'constraints' => [
                    new Length(max: 20),
                    new Regex(pattern: '/^[+]?[0-9\s\-\.()]*$/', message: 'Veuillez entrer un numéro valide.')
                ],
                'attr' => ['placeholder' => '+33 6 00 00 00 00'],
            ])
            ->add('subject', TextType::class, [
                'label' => 'Subject',
                'constraints' => [new NotBlank(message: 'Veuillez renseigner le sujet.'), new Length(max: 255)],
                'attr' => ['placeholder' => 'Booking inquiry'],
            ])
            ->add('message', TextareaType::class, [
                'label' => 'Message',
                'constraints' => [new NotBlank(message: 'Veuillez renseigner votre message.'), new Length(max: 5000)],
                'attr' => ['rows' => 5, 'placeholder' => 'Tell us about your stay'],
            ])
            ->add('submit', SubmitType::class, [
                'label' => 'Send',
                'attr' => ['class' => 'w-full sm:w-auto inline-flex justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'],
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => ContactMessage::class,
        ]);
    }
}

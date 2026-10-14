<?php
declare(strict_types=1);
namespace App\Form;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\FileType;
use Symfony\Component\Form\Extension\Core\Type\HiddenType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints as Assert;

final class TestTicketType extends AbstractType
{
    public function configureOptions(OptionsResolver $resolver): void
    { $resolver->setDefaults(['csrf_token_id' => 'team_ticket_create']); }
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder->add('title', TextType::class, ['label' => 'team.title', 'constraints' => [new Assert\NotBlank(), new Assert\Length(max: 180)]])
            ->add('category', ChoiceType::class, ['label' => 'team.category', 'choices' => ['team.category_bug' => 'bug', 'team.category_display' => 'display', 'team.category_suggestion' => 'suggestion']])
            ->add('description', TextareaType::class, ['label' => 'team.description', 'constraints' => [new Assert\NotBlank(), new Assert\Length(max: 10000)]])
            ->add('steps', TextareaType::class, ['label' => 'team.steps', 'required' => false, 'constraints' => [new Assert\Length(max: 10000)]])
            ->add('expected', TextareaType::class, ['label' => 'team.expected', 'required' => false, 'constraints' => [new Assert\Length(max: 10000)]])
            ->add('page', HiddenType::class, ['required' => false, 'constraints' => [new Assert\Length(max: 8192)]])
            ->add('screen', HiddenType::class, ['required' => false, 'constraints' => [new Assert\Regex('/^(?:\d{1,5}x\d{1,5})?$/D')]])
            ->add('capture', FileType::class, ['label' => 'team.capture', 'required' => false, 'constraints' => [new Assert\Image(maxSize: '5Mi', mimeTypes: ['image/png', 'image/jpeg', 'image/webp'], maxPixels: 40000000)], 'attr' => ['accept' => 'image/png,image/jpeg,image/webp']]);
    }
}

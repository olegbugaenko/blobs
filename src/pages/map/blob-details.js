export const BlobDetails = ({onFollow, isFollowing, isFPV, onSetFPV, ...props}) => {

    const onFollowClick = e => {
        e.preventDefault();
        e.stopPropagation();
        onFollow();
    }

    return (<div className={'blob-window box'}>
        <p>Blob: {props.id}</p>
        <p>Age: {props.age}</p>
        <p>Last Breed: {props.lastBreedTime}</p>
        <p>Sex: {props.sex}</p>
        <p>Hunger: {props.foodStat}</p>
        <p>Position: {props.displayX}:{props.displayY}</p>
        <p>Speed: {props.speed} ({props.dx}; {props.dy})</p>
        <p>Cell: {props.cellX}:{props.cellY}</p>
        <p>Activity: {props.action}</p>
        <p>AnimD: {props.animation}</p>
        {props.isPregnant ? 'Pregnant;' : ''}
        <div className={'buttons flex'}>
            <button onClick={onFollowClick}>{isFollowing ? 'Stop Following' : 'Follow'}</button>
            <button onClick={onSetFPV}>{isFPV ? 'Stop 1st person' : 'Start 1st person'}</button>
        </div>
    </div> )
}